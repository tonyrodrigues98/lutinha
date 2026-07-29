# Lutinha — auditoria visual e técnica

## Stack identificada

- Vite 7 e TypeScript 5.
- Phaser 3 para Canvas/WebGL, câmera, sprites e partículas.
- HTML/CSS para lobby, HUD e controles mobile.
- Express e Socket.IO para salas e simulação autoritativa.
- PWA com service worker.

Não há React, Three.js, Godot, Unity ou modelos 3D. A arquitetura atual já é adequada para um jogo de luta 2D e foi preservada.

## Diagnóstico do estado inicial

O combate, gravidade, dano, rounds, salas, times, arenas, câmera individual e multitouch já funcionavam. O problema principal estava em `src/game/sprites.ts`: cada frame era desenhado em Canvas por linhas grossas, polígonos, círculos e articulações aparentes. Isso produzia bonecos montados por primitivas, mesmo existindo várias poses.

O HUD e os efeitos já possuíam boa base, mas não havia personagens ilustrados, entrada/vitória dedicadas, indicador de combo nem controle de redução de movimento. A seleção oferecia quatro arquétipos incompletos.

## Direção aplicada

- Arcade 2D original com cel shading.
- Dois lutadores completos em vez de vários placeholders.
- Astra Nyx: duelista elétrica, ágil, silhueta vertical.
- Kael Forge: guardião de forja, pesado, silhueta ampla.
- Sprites WebP transparentes, 20 poses por lutador, 280 × 280 por frame.
- Física e lógica separadas da apresentação visual.
- Cor escolhida aplicada à aura, nome, rastro e efeitos sem destruir a arte do personagem.

## Plano executado

1. Preservar servidor, física, controles e protocolo multiplayer.
2. Substituir o gerador geométrico por atlas de sprites.
3. Reduzir a seleção a dois lutadores finalizados.
4. Mapear entrada, idle, corrida, dash, salto, soco, chute, defesa, dano, queda, especial e vitória.
5. Refinar impacto, rastros, aura, combo e redução de movimento.
6. Validar build, multiplayer, rolagem, arena e screenshots mobile/desktop.

