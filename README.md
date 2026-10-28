# Dibuja y adivina (versión web pública)

Juego multijugador sin dependencias: solo necesitas Node.js 18 o superior.

## Probar en tu computadora
    node server.js
Abre http://localhost:3000 en varias pestañas (o en otros dispositivos de tu red).

## Publicarlo en internet (gratis)
Súbelo a un hosting que ejecute Node, por ejemplo Render, Railway o Fly.io:
1. Sube esta carpeta a un repositorio de GitHub.
2. En Render: New → Web Service → elige el repositorio.
3. Build command: (vacío)  ·  Start command: `node server.js`
4. Cuando termine, tendrás una URL pública. Cualquiera puede jugar sin cuenta.

Nota: los planes gratuitos pueden "dormirse" tras un rato sin uso; la primera visita tarda unos segundos.
El estado vive en memoria: si el servidor se reinicia, las salas se reinician.
