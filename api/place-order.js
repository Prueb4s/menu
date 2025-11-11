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

    if (!orderDetails || !orderDetails.items || orderDetails.items.length === 0) {
      return res.status(400).json({ error: 'Datos de la orden inválidos o vacíos.' });
    }

    // Validar y actualizar stock por talla dentro del campo JSONB "sizes"
    // Recorremos cada ítem y actualizamos el producto correspondiente
    for (const item of orderDetails.items) {
      // item debe contener: id, qty, size (nombre de talla) y price
      const { id: productId, qty, size: sizeName } = item;
      if (!productId || !sizeName) {
        return res.status(400).json({ error: `Ítem inválido. Falta id o size en item: ${JSON.stringify(item)}` });
      }

      // Recuperar producto actual con el campo sizes
      const { data: product, error: selectErr } = await supabase
        .from('products')
        .select('id, sizes')
        .eq('id', productId)
        .single();

      if (selectErr) {
        console.error('Error al obtener producto para actualizar stock:', selectErr);
        return res.status(500).json({ error: 'Error al obtener producto para actualizar stock.' });
      }

      const sizes = Array.isArray(product.sizes) ? product.sizes : [];

      // Buscar la talla por nombre (case-insensitive)
      const sizeIndex = sizes.findIndex(s => String(s.name).toLowerCase() === String(sizeName).toLowerCase());
      if (sizeIndex === -1) {
        return res.status(400).json({ error: `Talla "${sizeName}" no encontrada para el producto ${productId}.` });
      }

      const sizeObj = sizes[sizeIndex];
      const currentStock = Number(sizeObj.stock || 0);

      if (currentStock < qty) {
        return res.status(400).json({ error: `Stock insuficiente para ${sizeObj.name}. Disponible: ${currentStock}` });
      }

      // Reducir stock localmente y actualizar el arreglo sizes
      const newSizes = [...sizes];
      newSizes[sizeIndex] = {
        ...sizeObj,
        stock: currentStock - qty
      };

      // Actualizar el producto con el nuevo arreglo sizes
      const { error: updateErr } = await supabase
        .from('products')
        .update({ sizes: newSizes })
        .eq('id', productId);

      if (updateErr) {
        console.error('Error al actualizar sizes del producto:', updateErr);
        return res.status(500).json({ error: `Error al actualizar stock para ${productId}: ${updateErr.message}` });
      }
    }

    // Insertar el pedido en la tabla 'orders'
    const orderData = {
      customer_name: orderDetails.name,
      customer_address: orderDetails.address,
      payment_method: orderDetails.payment,
      total_amount: orderDetails.total,
      order_items: orderDetails.items,
      order_status: 'Pendiente'
    };

    const { error: orderError } = await supabase.from('orders').insert([orderData]);

    if (orderError) {
      console.error('Error al guardar el pedido:', orderError);
      return res.status(500).json({ error: 'Error al guardar el pedido: ' + orderError.message });
    }

    return res.status(200).json({ success: true, message: 'Orden procesada con éxito.' });

  } catch (error) {
    console.error('Error en la API de orden:', error);
    return res.status(500).json({ error: error.message || String(error) });
  }
};