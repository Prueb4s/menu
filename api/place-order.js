import { createClient } from '@supabase/supabase-js';

export default async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const supabaseUrl = process.env.SB_URL;
  const supabaseServiceRoleKey = process.env.SB_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return res.status(500).json({ error: 'Error de configuración del servidor. Faltan claves.' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  try {
    const { orderDetails } = req.body;

    if (!orderDetails || !Array.isArray(orderDetails.items) || orderDetails.items.length === 0) {
      return res.status(400).json({ error: 'Datos de la orden inválidos o vacíos.' });
    }

    // Validaciones básicas de cada item para asegurar integridad mínima
    for (const [i, item] of orderDetails.items.entries()) {
      if (!item || !item.id) {
        return res.status(400).json({ error: `Item #${i + 1} inválido: falta id.` });
      }
      if (typeof item.qty === 'undefined' || Number(item.qty) <= 0) {
        return res.status(400).json({ error: `Item #${i + 1} inválido: qty debe ser mayor que 0.` });
      }
      if (typeof item.price === 'undefined' || isNaN(Number(item.price))) {
        return res.status(400).json({ error: `Item #${i + 1} inválido: price numérico requerido.` });
      }
      // Si el producto exige talla, el frontend debe enviar item.size
      if (item.requiresSize === true && !item.size) {
        return res.status(400).json({ error: `Item #${i + 1} requiere talla (size).` });
      }
    }

    // Preparar objeto para insertar en orders
    const orderData = {
      customer_name: orderDetails.name || null,
      customer_address: orderDetails.address || null,
      payment_method: orderDetails.payment || null,
      total_amount: orderDetails.total || 0,
      order_items: orderDetails.items,
      order_status: 'Pendiente'
    };

    const { error: orderError, data: inserted } = await supabase
      .from('orders')
      .insert([orderData])
      .select();

    if (orderError) {
      console.error('Error al guardar el pedido:', orderError);
      return res.status(500).json({ error: 'Error al guardar el pedido: ' + orderError.message });
    }

    // Responder éxito y devolver el registro insertado
    return res.status(200).json({ success: true, message: 'Orden procesada con éxito.', order: inserted && inserted[0] ? inserted[0] : null });

  } catch (error) {
    console.error('Error en la API de orden:', error);
    return res.status(500).json({ error: error.message || String(error) });
  }
};