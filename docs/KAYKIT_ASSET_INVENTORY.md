# Inventário KayKit usado no Riftfall Arsenal

## Conteúdo carregado antes do lobby

| Grupo | Conteúdo único | Uso |
|---|---:|---|
| Personagens | 4 GLB | Mage, Minion, Rogue e Warrior selecionáveis |
| Bibliotecas de animação | 8 GLB | Melee, ranged, general, movimento básico/avançado, simulation, special e tools |
| Armas selecionáveis | 26 GLB | Todas equipáveis e sincronizadas no multiplayer |
| Escudos selecionáveis | 7 GLB | Equipados na mão esquerda e usados no cálculo de defesa |
| Projéteis e acessórios | 11 GLB | Flechas, flechas quebradas, aljava, arcos sem corda e manoplas empilhadas |
| Retratos | 4 WebP | Render transparente dos próprios personagens |
| Arenas | 4 WebP | Fundo sincronizado para os dois jogadores |

## Personagens

- `Skeleton_Mage.glb`
- `Skeleton_Minion.glb`
- `Skeleton_Rogue.glb`
- `Skeleton_Warrior.glb`

Todos usam `Rig_Medium`. Armas e escudos são anexados a `handslot.r` e `handslot.l`, então acompanham corretamente a animação.

## Bibliotecas de animação

- `Rig_Medium_CombatMelee.glb`
- `Rig_Medium_CombatRanged.glb`
- `Rig_Medium_General.glb`
- `Rig_Medium_MovementAdvanced.glb`
- `Rig_Medium_MovementBasic.glb`
- `Rig_Medium_Simulation.glb`
- `Rig_Medium_Special.glb`
- `Rig_Medium_Tools.glb`

O loader registra todos os clips únicos dos oito arquivos. O combate seleciona clips coerentes com o equipamento; os demais ficam disponíveis na memória para estados, emotes, treino e expansão sem nova requisição.

## Arsenal

Todas as variantes únicas de machado, arco com corda, adaga, arma de punho, alabarda, martelo, lança, cajado, espada, varinha, arma e escudo de esqueleto aparecem no seletor ou como acessórios/projéteis.

Os arquivos FBX, OBJ, `fbx(unity)` e versões de arco sem corda não duplicam o download principal. Arcos sem corda, armas empilhadas e flechas quebradas foram reservados para troféus e destroços da arena.

## Carregamento

O loader trabalha com cinco requisições concorrentes, atualiza progresso real e só libera o lobby depois de:

1. baixar os quatro personagens;
2. registrar as oito bibliotecas de animação;
3. baixar todo o arsenal e acessórios;
4. decodificar os quatro retratos;
5. decodificar as quatro arenas.

O service worker armazena as respostas após o primeiro carregamento.
