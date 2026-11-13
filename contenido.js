/* =========================================================
   CONTENIDO DEL REGALO — edita SOLO este archivo
   Las fotos van en assets/fotos/, la música en assets/musica/
   ========================================================= */
window.CONTENIDO = {
  nombreElla: "Nyzzi",
  nombreEl: "Andrés",
  edad: 19,

  // Fecha y hora en que se desbloquea el regalo (hora local del celular de ELLA).
  // Antes de esa hora se ve una cuenta regresiva.
  // Para probarlo tú antes, abre la página con ?preview al final del link.
  fechaDesbloqueo: "2026-11-13T00:00:00-06:00", // medianoche hora de México (UTC-6)

  // Canción de fondo: pon el .mp3 en assets/musica/ con este nombre.
  // Si el archivo no existe, la página funciona igual (sin música).
  cancion: {
    archivo: "",
    // Link de Spotify o YouTube: aparece un botón "Nuestra canción" en el menú
    enlace: "",
    titulo: "Flores de gardenias",
    artista: "",
  },

  // Mini juego: frase al empezar y al ganar
  juego: {
    intro: "Atrapa los 19 corazones para desbloquear tu regalo",
    victoria: "¡Nivel completado! Desbloqueaste tu regalo",
  },

  // Línea de tiempo (cada uno es un "nivel"). fecha puede ser texto libre.
  recuerdos: [
    {
      fecha: "Hace 19 años",
      titulo: "Nace una estrella",
      texto: "Desde bebé ya posabas con lentes de sol como toda una celebridad. Algunas cosas nunca cambian.",
      foto: ["assets/fotos/bebe-lentes.jpg", "assets/fotos/bebe-sombrero.jpg"],
    },
    {
      fecha: "22 de abril",
      titulo: "El día que nos conocimos",
      texto: "Ese día no sabía que estaba conociendo a la persona más importante de mi vida.",
    },
    {
      fecha: "5 de junio",
      titulo: "Nos hicimos señor y señora",
      texto: "El día que dejamos de ser tú y yo para ser nosotros.",
      foto: "assets/fotos/flores-cena.jpg",
    },
    {
      fecha: "Todas las noches",
      titulo: "Videollamadas infinitas",
      texto: "Una pantalla de por medio y aun así eres lo más bonito de mi día. Hasta con una flor en el pelo me robas el aire.",
      foto: "assets/fotos/videollamada-flor.jpg",
    },
    {
      fecha: "Siempre",
      titulo: "La hincha número 1",
      texto: "Te pusiste la camiseta de Colombia por mí. Sentí una alegría indescriptible.",
      foto: "assets/fotos/videollamada-colombia.jpg",
    },
    {
      fecha: "Por fin",
      titulo: "Las escaleras de Atlixco",
      texto: "Frente a las escaleras recuerdo mucho nuestras fotitos juntos, no lo podré olvidar jamás.",
      foto: "assets/fotos/escaleras-atlixco.jpg",
    },
    {
      fecha: "Esa tarde",
      titulo: "Entre alebrijes y talavera",
      texto: "Recorriendo tiendas contigo, robándote besos frente al espejo.",
      foto: "assets/fotos/alebrijes.jpg",
    },
    {
      fecha: "Para siempre",
      titulo: "Nuestros anillos",
      texto: "Dos anillos y una promesa: la distancia es temporal, lo nuestro no.",
      foto: "assets/fotos/manos-anillos.jpg",
    },
    {
      fecha: "Agosto 2027",
      titulo: "Próximo nivel: volver a verte",
      texto: "Este nivel todavía no lo jugamos, pero ya lo estoy esperando con todo mi corazón.",
      foto: "assets/fotos/videollamada-camisetas.jpg",
    },
  ],

  // Nuestras canciones: "youtube" = id del video (lo que va después de v= en el link).
  // Si no hay youtube, se usa "spotify" (link de compartir) o un botón de búsqueda.
  canciones: [
    {
      titulo: "Perfume de Gardenias",
      artista: "La Sonora Santanera",
      razon: "Porque tú eres como un ramo de flores: llenas todo de color y de buen aroma, igual que el ramo que te di esa noche.",
      youtube: "DFSdDVnbVds",
      spotify: "",
    },
    {
      titulo: "Enséñame a bailar",
      artista: "Bad Bunny",
      razon: "Porque contigo quiero aprenderlo todo, hasta a bailar, aunque nos pisemos los pies.",
      youtube: "STDOd4w9Brw",
      spotify: "",
    },
    {
      titulo: "Mi Refe",
      artista: "Beéle, Ovy On The Drums",
      razon: "Porque tú eres mi referencia: cuando pienso en algo bonito, pienso en ti.",
      youtube: "007z2kRHxH0",
      spotify: "",
    },
    {
      titulo: "WELTiTA",
      artista: "Bad Bunny, Chuwi",
      razon: "Porque lo único que quiero es darme una weltita contigo de la mano, como por las calles de Atlixco.",
      youtube: "vmbyVU9w47Y",
      spotify: "",
    },
    {
      titulo: "Vamos a mirarnos",
      artista: "Rels B",
      razon: "Porque en cada videollamada nos quedamos mirándonos sin decir nada, y aun así nos lo decimos todo.",
      youtube: "SX24AyFeFgs",
      spotify: "",
    },
  ],

  // 19 razones por las que la quieres
  razones: [
    "Tu sonrisa, que se te escapa aunque intentes posar seria.",
    "Que conviertes cualquier videollamada en la mejor parte de mi día.",
    "Que te pusiste la camiseta de Colombia por mí.",
    "Tus caras chistosas que solo yo conozco.",
    "Porque eres a luz da minha vida.",
    "Que desde bebé ya tenías estilo con tus lentes de sol.",
    "Cómo te ríes de mis tonterías (aunque no den risa).",
    "Que haces que 3.000 km se sientan cerquita.",
    "Que me mostraste Atlixco y ahora es mi lugar favorito del mundo.",
    "Tu paciencia con la distancia y conmigo.",
    "Lo bonita que eres sin siquiera intentarlo.",
    "Que eres mi señora desde el 5 de junio.",
    "Que me escuchas incluso cuando estoy cansado o de mal humor.",
    "Tu valentía, hasta en medio del mar con chaleco salvavidas.",
    "Que contigo hasta probarse lentes en una tienda es una aventura.",
    "Cómo me miras cuando crees que no me doy cuenta.",
    "Que me haces querer ser mejor cada día.",
    "Que sé que puedo contar contigo, y tú conmigo, siempre.",
    "Que hoy cumples 19 y tengo la suerte de que me elijas a mí.",
  ],

  // La distancia
  distancia: {
    ciudadElla: { nombre: "Atlixco", lat: 18.9087, lon: -98.4364 },
    ciudadEl: { nombre: "Bucaramanga", lat: 7.1193, lon: -73.1227 },
    proximoEncuentro: "2027-08-01",
    proximoEncuentroTexto: "agosto 2027",
  },

  // Audios / videos (vacío: en su lugar se muestra la galería de fotos)
  media: [],

  // Galería de fotos (se muestra en "Nuestra galería")
  galeria: [
    { foto: "assets/fotos/escaleras-atlixco.jpg", pie: "Atlixco" },
    { foto: "assets/fotos/lentes-1.jpg", pie: "Probando lentes" },
    { foto: "assets/fotos/lentes-2.jpg", pie: "Modo serios" },
    { foto: "assets/fotos/alebrijes.jpg", pie: "Alebrijes" },
    { foto: "assets/fotos/talavera-1.jpg", pie: "Mi modelo" },
    { foto: "assets/fotos/talavera-2.jpg", pie: "Mi favorita" },
    { foto: "assets/fotos/selfie-nariz.jpg", pie: "Payasitos" },
    { foto: "assets/fotos/flores-cena.jpg", pie: "Tus flores" },
    { foto: "assets/fotos/flores-nota.jpg", pie: "A luz da minha vida" },
    { foto: "assets/fotos/cena-musica.jpg", pie: "Cena con música" },
    { foto: "assets/fotos/manos-anillos.jpg", pie: "Señor y señora" },
    { foto: "assets/fotos/videollamada-flor.jpg", pie: "Videollamada" },
    { foto: "assets/fotos/videollamada-lengua.jpg", pie: "Esa carita" },
    { foto: "assets/fotos/videollamada-colombia.jpg", pie: "Hincha" },
    { foto: "assets/fotos/videollamada-camisetas.jpg", pie: "Selección" },
    { foto: "assets/fotos/mar.jpg", pie: "Sirena" },
    { foto: "assets/fotos/bebe-lentes.jpg", pie: "Mini diva" },
    { foto: "assets/fotos/bebe-sombrero.jpg", pie: "Mini tú" },
  ],

  // Vales para cuando se vean
  cupones: [
    "Una cita donde tú eliges todo, sin quejas de mi parte",
    "Un abrazo de 10 minutos sin soltarte",
    "Una cena con velas y música en vivo, como esa noche",
    "Un tour por Bucaramanga con tu guía personal",
    "Un día de películas, cobijas y comida",
    "Una sesión de fotos donde yo soy tu fotógrafo oficial",
    "Un ramo de flores, porque te lo mereces siempre",
  ],

  // Carta final (cada elemento es un párrafo)
  carta: [
    "Feliz cumpleaños número 19, mi amor.",
    "Hoy quisiera estar ahí para abrazarte fuerte, cantarte las mañanitas y verte soplar las velas. Como la distancia no me deja, hice lo que mejor sé hacer: programarte un regalo, línea por línea, pensando en ti.",
    "Desde aquel 22 de abril, mi vida cambió. Y desde el 5 de junio tengo la suerte de llamarte mi señora. Gracias por tu paciencia, por cada videollamada, por cada risa y por elegirme todos los días aunque nos separen más de 3.000 kilómetros.",
    "Eres a luz da minha vida. Este año quiero que cumplas todo lo que te propongas, que nunca dejes de sonreír así, y que sepas que, pase lo que pase, aquí estoy para ti.",
    "Ya cuento los días para agosto. Mientras tanto, este pedacito de internet es tuyo.",
    "Te amo con todo mi corazón.",
  ],
};
