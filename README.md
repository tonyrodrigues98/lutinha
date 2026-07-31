# Riftfall Arsenal

Jogo de luta 3D mobile-first, online para duas pessoas ou offline contra CPU. Os jogadores montam personagens com assets KayKit reais e podem lutar em uma sala compartilhada ou treinar localmente.

## O que funciona

- multiplayer real com Socket.IO e servidor autoritativo;
- modo offline contra CPU com três dificuldades;
- quatro personagens 3D selecionáveis;
- 26 armas e sete escudos sincronizados;
- armas e escudos presos obrigatoriamente aos sockets `handslot.r` e `handslot.l` dos rigs durante todas as animações;
- combate diferente por arma: leve, uma mão, pesado, lança, arco, besta ou magia;
- necromante com conjuração mais lenta, alcance e dano reduzidos para permitir aproximação e contra-ataque;
- mais de 100 clips KayKit carregados no boot;
- câmera individual com dead zone e acompanhamento amortecido do movimento renderizado;
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
