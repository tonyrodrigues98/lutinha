# Riftfall Arsenal

Jogo de luta 3D online, mobile-first, para duas pessoas. Os jogadores entram na mesma sala, escolhem equipes opostas e montam um personagem com assets KayKit reais.

## O que funciona

- multiplayer real com Socket.IO e servidor autoritativo;
- quatro personagens 3D selecionáveis;
- 26 armas e sete escudos sincronizados;
- armas presas aos bones das mãos durante todas as animações;
- combate diferente por arma: leve, uma mão, pesado, lança, arco, besta ou magia;
- mais de 100 clips KayKit carregados no boot;
- câmera individual centralizada no personagem local;
- movimento, dash, salto, defesa, ataque, chute e especial multitouch;
- quatro arenas, 12 cores de essência e melhor de três;
- loading inicial com progresso real e cache PWA;
- sala por nome livre, inclusive espaços, acentos, emojis e símbolos;
- Docker e Render prontos para deploy.

## Stack

- TypeScript + Vite
- Three.js para cena, modelos, iluminação e animações
- Socket.IO para sincronização
- Express para produção

## Rodar localmente

Requisitos: Node.js 22 ou superior.

```bash
npm install
npm run dev
```

Abra `http://localhost:5173` em duas abas. Use o mesmo nome de sala e equipes diferentes.

## Produção

```bash
npm run build
npm start
```

O servidor usa `PORT` e entrega o frontend e o WebSocket no mesmo endereço.
