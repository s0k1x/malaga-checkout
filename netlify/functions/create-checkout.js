// Esta función corre en el servidor de Netlify, NUNCA en el navegador del cliente.
// Aquí sí puede vivir la clave secreta de Stripe (como variable de entorno, no escrita aquí).
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// TODO: cuando tengas dominio o la URL final de tu tienda, puedes dejarla fija aquí también.
// Por defecto, la tomamos del propio origen que hace la petición (más flexible).

exports.handler = async (event) => {
  // Cabeceras CORS: permiten que tu web en GitHub Pages llame a esta función
  // aunque viva en otro dominio (netlify.app).
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // El navegador manda una petición OPTIONS antes de la real (comprobación CORS) — respondemos OK sin más.
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: 'Método no permitido' };
  }

  try {
    const data = JSON.parse(event.body);
    const { items, email, successUrl, cancelUrl } = data;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'No hay artículos en el carrito.' }) };
    }

    // Construimos las líneas de producto para Stripe a partir de lo que manda el carrito.
    // Los precios se recalculan aquí, en el servidor, a partir de lo que nos manda el cliente
    // (en una versión más avanzada, lo ideal es volver a comprobar el precio real contra Firestore
    // para que nadie pueda manipular el precio desde el navegador antes de pagar).
    const line_items = items.map(it => ({
      price_data: {
        currency: 'eur',
        product_data: { name: it.nombre },
        unit_amount: Math.round(it.precio * 100) // Stripe usa céntimos
      },
      quantity: it.cantidad
    }));

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items,
      customer_email: email || undefined,
      success_url: successUrl,
      cancel_url: cancelUrl
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ url: session.url, id: session.id })
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
