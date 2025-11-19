export default (req, res) => {
  
  const SB_URL = process.env.SB_URL;
  const SB_ANON_KEY = process.env.SB_ANON_KEY;

  console.log('--- Diagnóstico API Config ---');
  console.log('URL Cargada:', !!SB_URL); 
  console.log('ANON_KEY Cargada:', !!SB_ANON_KEY);
  console.log('------------------------------');

  if (!SB_URL || !SB_ANON_KEY) {
    
    return res.status(500).json({ 
      error: 'Variables de entorno de SB faltantes en la configuración de Vercel.',
      url: null,
      anonKey: null,
      requireSizeSelection: null
    });
  }

  // Exigir selección de tamaño
  res.status(200).json({
    url: SB_URL,
    anonKey: SB_ANON_KEY,
    requireSizeSelection: true
  });
};