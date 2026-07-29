# Riftfall Duel

Jogo de luta 2D online, mobile-first, para dois jogadores. Cada pessoa entra na mesma arena por um código curto e escolhe um lado diferente: azul ou vermelho.

## O que já funciona

- multiplayer real com Socket.IO e salas privadas por código;
- servidor autoritativo para movimento, gravidade, colisão, dano e placar;
- câmera individual seguindo e centralizando o personagem local;
- controles multitouch: esquerda, direita, salto, defesa, ataque e especial;
- teclado no desktop: `A/D`, `W` ou `Espaço`, `J`, `K` e `L`;
- dois lutadores originais ilustrados, Astra Nyx e Kael Forge, com sprites transparentes e estados de entrada, idle, corrida, salto, ataque, especial, defesa, dano, nocaute e vitória;
- arena original em alta resolução, partículas, impacto, screen shake, som sintético e vibração;
- 12 cores de energia, quatro arenas, indicador de combo e modo de movimento reduzido;
- melhor de três, rodadas de 60 segundos e reinício automático;
- PWA instalável e preparada para tela cheia em modo paisagem;
- deploy pronto por Docker/Render.

## Rodar localmente

Requisitos: Node.js 22 ou superior.

```bash
npm install
npm run dev
```

Abra `http://localhost:5173` em duas abas. Entre nas duas com o mesmo código, escolhendo azul em uma e vermelho na outra.

Para testar em dois celulares na mesma rede Wi-Fi, abra `http://IP-DO-COMPUTADOR:5173` nos dois aparelhos. O firewall do computador precisa permitir as portas 5173 e 3001.

## Produção

```bash
npm run build
npm start
```

O servidor usa a porta informada em `PORT` e entrega tanto o jogo compilado quanto a conexão WebSocket. Não é necessário banco de dados para partidas efêmeras.

No Render, crie um Web Service a partir deste repositório e use o Dockerfile. O arquivo `render.yaml` já contém a configuração mínima.

## Protocolo da partida

O cliente envia somente a intenção dos controles. O servidor mantém a fonte de verdade da luta em 60 atualizações por segundo e distribui snapshots 20 vezes por segundo. Essa separação reduz divergências entre aparelhos e dificulta alterações simples de vida, energia ou posição feitas pelo navegador.
