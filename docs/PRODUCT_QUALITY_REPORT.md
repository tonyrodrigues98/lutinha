# Lutinha — relatório da reconstrução visual

## Implementado

- Substituição integral dos lutadores geométricos por sprites ilustrados.
- Dois personagens jogáveis: Astra Nyx e Kael Forge.
- Vinte poses transparentes por personagem.
- Estados visuais: entrada, idle, corrida, dash, salto/aterrissagem, soco, chute, especial forte, defesa, dano, queda e vitória.
- Estatísticas próprias por personagem preservadas no servidor autoritativo.
- Aura e rastros ligados às 12 cores selecionáveis.
- Slash de impacto, partículas proporcionais ao golpe, reação corporal e câmera.
- Indicador de combo.
- Alternância de redução de animações e tremores pelo botão `FX`.
- Thumbnails reais dos personagens no lobby.
- Correção de largura e overflow horizontal do lobby mobile.
- Cache PWA atualizado para os novos sheets.

## Validação executada

- `npm run build`: aprovado.
- `npm run test:multiplayer`: aprovado.
- Chromium headless real, sem erros de console:
  - 390 × 844, lobby em retrato.
  - 844 × 390, partida multiplayer em paisagem.
  - 1440 × 900, lobby desktop.
- Rolagem mobile comprovada: documento com 1152 px, viewport com 844 px, deslocamento de 308 px.
- Overflow horizontal: 390 px de documento para 390 px de viewport.
- Troca da arena no lobby: `data-arena="neon"` validado antes da partida.
- Dois clientes Socket.IO entraram na mesma sala e renderizaram um Canvas por jogador.

## Evidências

- `quality-evidence/mobile-lobby-top.webp`
- `quality-evidence/mobile-lobby-neon-bottom.webp`
- `quality-evidence/mobile-fight-astra-vs-kael.webp`
- `quality-evidence/mobile-fight-kael-camera.webp`
- `quality-evidence/desktop-lobby-kael-ember.webp`

## Limitações restantes

- Os sheets usam de dois a cinco keyframes por estado; uma futura etapa pode aumentar a interpolação de ações específicas.
- O áudio permanece sintetizado no navegador, sem trilha musical licenciada.
- Gamepad ainda não foi implementado.
- O gate final ainda precisa de teste físico em iPhone e Android intermediário para medir FPS, temperatura e multitouch real.

Por essas limitações físicas e de áudio, esta branch é uma candidata visual forte, mas não deve ser declarada produção final sem o teste em aparelhos reais.

