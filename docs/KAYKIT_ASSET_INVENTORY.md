# Inventário KayKit usado no Riftfall Arsenal

## Conteúdo carregado antes do lobby

| Grupo | Conteúdo único | Uso |
|---|---:|---|
| Personagens | 12 GLB | 4 Skeletons, 6 Adventurers e 2 Mannequins selecionáveis |
| Bibliotecas de animação | 14 GLB | 8 bibliotecas Rig Medium e 6 bibliotecas Rig Large |
| Armas selecionáveis | 41 GLB | Todas equipáveis e sincronizadas no multiplayer |
| Escudos selecionáveis | 16 GLB | Equipados na mão esquerda e usados no cálculo de defesa |
| Projéteis e acessórios | 14 GLB | Flechas, flechas quebradas, aljavas, arcos sem corda e manoplas empilhadas |
| Retratos | 12 WebP/PNG | Retratos dos 12 modelos selecionáveis |
| Arenas | 4 WebP | Fundo sincronizado para os dois jogadores |

## Personagens

- `Skeleton_Mage.glb`
- `Skeleton_Minion.glb`
- `Skeleton_Rogue.glb`
- `Skeleton_Warrior.glb`
- `Barbarian.glb`
- `Knight.glb`
- `Mage.glb`
- `Ranger.glb`
- `Rogue.glb`
- `Rogue_Hooded.glb`
- `Mannequin_Medium.glb`
- `Mannequin_Large.glb`

Os dez personagens principais e o Mannequin Medium usam `Rig_Medium`; o Mannequin Large usa `Rig_Large`. Armas e escudos são anexados aos sockets de runtime das mãos e acompanham corretamente a animação. O `GLTFLoader` remove o ponto de `handslot.r/l`, por isso o resolver normaliza os nomes. O Mannequin Medium não traz sockets no arquivo e recebe sockets KayKit equivalentes como filhos dos bones `hand.r/l`.

## Bibliotecas de animação

- `Rig_Medium_CombatMelee.glb`
- `Rig_Medium_CombatRanged.glb`
- `Rig_Medium_General.glb`
- `Rig_Medium_MovementAdvanced.glb`
- `Rig_Medium_MovementBasic.glb`
- `Rig_Medium_Simulation.glb`
- `Rig_Medium_Special.glb`
- `Rig_Medium_Tools.glb`
- `Rig_Large_CombatMelee.glb`
- `Rig_Large_General.glb`
- `Rig_Large_MovementAdvanced.glb`
- `Rig_Large_MovementBasic.glb`
- `Rig_Large_Simulation.glb`
- `Rig_Large_Special.glb`

O loader registra todos os clips únicos dos oito arquivos. O combate seleciona clips coerentes com o equipamento; os demais ficam disponíveis na memória para estados, emotes, treino e expansão sem nova requisição.

## Arsenal

Todas as variantes de combate dos packs Skeletons, Fantasy Weapons Bits e Adventurers aparecem no seletor: machados, arcos, bestas, adagas, armas de punho, alabarda, martelos, lança, cajados, grimórios, espadas, varinhas, bomba de fumaça e todos os escudos.

Os arquivos FBX, OBJ, `fbx(unity)` e versões de arco sem corda não duplicam o download principal. Arcos sem corda, armas empilhadas e flechas quebradas foram reservados para troféus e destroços da arena.

## Carregamento

O loader trabalha com cinco requisições concorrentes, atualiza progresso real e só libera o lobby depois de:

1. baixar os doze personagens;
2. registrar as quatorze bibliotecas de animação;
3. baixar todo o arsenal e acessórios;
4. confirmar os doze retratos;
5. baixar as quatro arenas.

O service worker armazena as respostas após o primeiro carregamento.

## Validação

O teste automatizado confere os 12 rigs e os 57 equipamentos selecionáveis. O playtest WebGL monta todas as armas e escudos em cada personagem; armas duplas geram 744 objetos equipados verificados, sem bounds vazios, socket ausente ou erro de console.
