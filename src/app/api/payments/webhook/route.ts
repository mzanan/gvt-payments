import { NextRequest, NextResponse } from 'next/server';
import { 
  updatePaymentStatus, 
  findPendingPayments,
  findPaymentByOrderId
} from '@/db/payment';
import { PaymentStatus } from '@/types/payment';

// Tipo para los datos del webhook
interface WebhookData {
  meta?: {
    custom_data?: {
      order_id?: string;
    };
  };
  data?: {
    id?: string;
    attributes?: {
      status?: string;
    };
  };
}

/**
 * Maps a LemonSqueezy payment status to our internal PaymentStatus enum
 */
function mapPaymentStatus(lsStatus: string): PaymentStatus {
  // Normalizar el estado a minúsculas para evitar problemas de sensibilidad a mayúsculas
  const normalizedStatus = (lsStatus || '').toLowerCase();
  
  console.log(`WEBHOOK - Mapeando estado original: '${lsStatus}' (normalizado: '${normalizedStatus}')`);
  
  // Mapeo de estados de LemonSqueezy a nuestros estados internos
  let mappedStatus: PaymentStatus;
  
  switch(normalizedStatus) {
    case 'pending':
      mappedStatus = PaymentStatus.PENDING;
      console.log(`WEBHOOK - Estado mapeado a PaymentStatus.PENDING (${mappedStatus})`);
      break;
    case 'paid':
    case 'completed':
    case 'success':
      mappedStatus = PaymentStatus.PAID;
      console.log(`WEBHOOK - Estado mapeado a PaymentStatus.PAID (${mappedStatus})`);
      break;
    case 'void':
    case 'cancelled':
    case 'canceled':
      mappedStatus = PaymentStatus.VOID;
      console.log(`WEBHOOK - Estado mapeado a PaymentStatus.VOID (${mappedStatus})`);
      break;
    case 'refunded':
      mappedStatus = PaymentStatus.REFUNDED;
      console.log(`WEBHOOK - Estado mapeado a PaymentStatus.REFUNDED (${mappedStatus})`);
      break;
    default:
      mappedStatus = PaymentStatus.PENDING;
      console.log(`WEBHOOK - Estado desconocido '${lsStatus}', mapeado a PaymentStatus.PENDING (${mappedStatus}) por defecto`);
      break;
  }
  
  console.log(`WEBHOOK - Resultado final del mapeo: '${lsStatus}' -> PaymentStatus.${PaymentStatus[mappedStatus]} (${mappedStatus})`);
  
  return mappedStatus;
}

export async function POST(request: NextRequest) {
  // Iniciar un temporizador para detectar operaciones que tardan demasiado
  const requestStartTime = Date.now();
  
  try {
    console.log('WEBHOOK - Solicitud recibida');
    
    // Capturar headers originales para diagnóstico
    const headers = Object.fromEntries([...request.headers.entries()]);
    console.log('WEBHOOK - Headers recibidos:', JSON.stringify(headers, null, 2));
    
    // Añadir un timeout para la operación de parsing del JSON
    let jsonData: WebhookData;
    try {
      const jsonParsePromise = request.json();
      // Establecer un timeout de 5 segundos para el parse de JSON
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout al procesar el JSON del webhook')), 5000);
      });
      
      jsonData = await Promise.race([jsonParsePromise, timeoutPromise]) as WebhookData;
      
      // Validar que tenemos los datos mínimos necesarios
      if (!jsonData || !jsonData.data) {
        throw new Error('Datos del webhook incompletos o malformados');
      }
    } catch (error) {
      console.log('WEBHOOK - Error crítico al procesar datos JSON:', error);
      return NextResponse.json({ 
        success: false, 
        error: 'Error al procesar payload del webhook',
        message: error instanceof Error ? error.message : 'Error desconocido'
      }, { status: 400 });
    }
    
    console.log('WEBHOOK - Payload completo recibido:', JSON.stringify(jsonData, null, 2));
    
    // Destacar específicamente el estado crudo si existe
    const rawStatus = jsonData?.data?.attributes?.status;
    console.log('WEBHOOK - Estado crudo recibido:', rawStatus);
    
    const eventName = request.headers.get('x-event-name');
    console.log('WEBHOOK - Evento:', eventName);
    
    // Solo procesar eventos de tipo order_created
    if (eventName !== 'order_created') {
      console.log('WEBHOOK - Ignorando evento no-order:', eventName);
      return NextResponse.json({ success: true });
    }

    // Extraer IDs del webhook
    const identifier_id = jsonData?.meta?.custom_data?.order_id || 
                          jsonData?.data?.id;
    const numeric_id = jsonData?.data?.id;
    
    if (!identifier_id) {
      console.log('WEBHOOK - Error: Falta identificador de orden');
      return NextResponse.json(
        { error: 'Missing order identifier' },
        { status: 400 }
      );
    }
    
    console.log('WEBHOOK - IDs extraídos:', { identifier_id, numeric_id });

    // Buscar pago por ID con manejo de errores y timeout
    let payment = null;
    try {
      // Establecer un timeout para la operación de búsqueda
      const findPaymentPromise = findPaymentByOrderId(identifier_id);
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout al buscar pago')), 10000);
      });
      
      payment = await Promise.race([findPaymentPromise, timeoutPromise]);
      console.log('WEBHOOK - Búsqueda de pago completada:', payment ? 'Encontrado' : 'No encontrado');
    } catch (error) {
      console.log('WEBHOOK - Error al buscar pago:', error);
      // No fallamos aquí, continuamos el flujo para buscar pagos pendientes
    }
    
    // Verificar el tiempo transcurrido para detectar respuestas lentas
    const currentTime = Date.now();
    const elapsedTime = currentTime - requestStartTime;
    if (elapsedTime > 5000) {
      console.log(`WEBHOOK - ADVERTENCIA: Procesamiento lento (${elapsedTime}ms) al buscar pago`);
    }
    
    // Si no se encuentra el pago por el identificador, intentar buscar por estado pendiente
    let orderId = identifier_id;
    if (!payment) {
      console.log('WEBHOOK - Buscando pagos pendientes como alternativa');
      
      let pendingPayments = [];
      try {
        // Añadir timeout también para esta operación
        const findPendingPromise = findPendingPayments();
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Timeout al buscar pagos pendientes')), 10000);
        });
        
        pendingPayments = await Promise.race([findPendingPromise, timeoutPromise]) || [];
        console.log('WEBHOOK - Pagos pendientes encontrados:', pendingPayments?.length || 0);
      } catch (error) {
        console.log('WEBHOOK - Error al buscar pagos pendientes:', error);
        // No fallamos, usamos array vacío y continuamos
        pendingPayments = [];
      }
      
      // Encontrar el pago pendiente más reciente
      if (pendingPayments && pendingPayments.length > 0) {
        const mostRecentPayment = pendingPayments.sort((a: { created_at: string }, b: { created_at: string }) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0];
        
        orderId = mostRecentPayment.order_id;
        console.log('WEBHOOK - Pago pendiente encontrado para asociar:', orderId);
      }
    }

    // Mapear el estado de LemonSqueezy a nuestro estado interno
    const lsStatus = jsonData?.data?.attributes?.status || '';
    console.log('WEBHOOK - Estado original:', lsStatus);
    
    const status = mapPaymentStatus(lsStatus);
    console.log('WEBHOOK - Estado mapeado final:', status);

    // Actualizar el estado del pago en la base de datos con timeout
    try {
      console.log('WEBHOOK - Actualizando estado:', { orderId, status });
      
      const updatePromise = updatePaymentStatus(orderId, status, {
        numeric_id,
        identifier_id
      });
      
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout al actualizar estado de pago')), 10000);
      });
      
      const updateResult = await Promise.race([updatePromise, timeoutPromise]);
      console.log('WEBHOOK - Resultado de la actualización:', updateResult);
    } catch (error) {
      console.log('WEBHOOK - Error al actualizar estado:', error);
      // Este es un error crítico - respondemos con error pero aún así con 200 para que
      // el proveedor no reintente continuamente
      return NextResponse.json({ 
        success: false,
        message: 'Error al actualizar estado de pago',
        error: error instanceof Error ? error.message : 'Error desconocido'
      });
    }

    // Verificar tiempo total de procesamiento
    const totalTime = Date.now() - requestStartTime;
    console.log(`WEBHOOK - Procesamiento completado en ${totalTime}ms`);
    
    if (totalTime > 10000) {
      console.log('WEBHOOK - ADVERTENCIA: Procesamiento total muy lento');
    }
    
    console.log('WEBHOOK - Procesamiento completado con éxito');
    return NextResponse.json({ success: true });
  } catch (error) {
    const totalTime = Date.now() - requestStartTime;
    console.log(`WEBHOOK - Error general después de ${totalTime}ms:`, error);
    
    // Aunque hubo un error, respondemos con 200 para evitar reintentos
    // pero incluimos información sobre el error
    return NextResponse.json({ 
      success: false,
      error: 'Error al procesar webhook',
      message: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}