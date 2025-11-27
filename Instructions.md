# Instructions – naprawa FX i VU w VISUS Experimental

## 1) Posprzątaj duplikaty `fxVuLevels`
- **Pliki:** `App.tsx`, `ExperimentalApp.tsx`
- W obu plikach zostaw tylko JEDNĄ deklarację stanu i refa:
  - `const [fxVuLevels, setFxVuLevels] = useState({ main: 0, fx1: 0, fx2: 0, fx3: 0, fx4: 0, fx5: 0 });`
  - `const fxVuLevelsRef = useRef(fxVuLevels);`
- Usuń powielone deklaracje (błędy TS “Cannot redeclare…”). Typowo stan i ref są blisko innych useState/useRef na początku komponentu.
- Dodaj `useEffect(() => { fxVuLevelsRef.current = fxVuLevels; }, [fxVuLevels]);` obok innych efektów synchronizujących refy.

## 2) Mocniejsze mapowanie FX w `ExperimentalApp.tsx`
- Sekcja pętli renderowej (kawałek z `computeFxVal` / `computeFxVu`):
  - `computeFxVal`: użyj `sourceLevel` * `bandGain` (poprzez `getActivationLevel`) z powermappingiem `Math.pow(sourceLevel, 0.3)`; mnożnik ~22; offset ~0.8 dla routingu ≠ off; clamp 0..24.
    ```ts
    const boosted = (Math.pow(sourceLevel, 0.3) * gainMult * 22.0) + (config.routing === 'off' ? 0 : 0.8);
    const fxVal = Math.min(24.0, boosted);
    ```
  - `computeFxVu`: podobnie, ale łagodniej: `Math.pow(sourceLevel, 0.5) * gainMult`, clamp ~0..2.2.
  - Upewnij się, że `getActivationLevel` mnoży pasmo przez `syncParamsRef.current[i]?.gain`.

## 3) Aktualizuj stany UI w pętli renderowej (ExperimentalApp)
- Co ~80ms (tam, gdzie jest `if (now - lastUiUpdateRef.current > 80)`) ustawiaj **oba** stany:
  - `setVisualLevels(lvls);`
  - `setFxVuLevels(vuPacket);`

## 4) Przekaż VU do slotów FX
- W renderze FX Chain w `ExperimentalApp.tsx`:
  - Dla main: `<FxSlot ... activeLevel={visualLevels.main} vuLevel={fxVuLevels.main} />`
  - Dla warstw fx1..fx5: przekazuj `activeLevel={(visualLevels as any)[fxName]}` oraz `vuLevel={(fxVuLevels as any)[fxName]}`.

## 5) `FxSlot.tsx` – użycie `vuLevel`
- Prop `vuLevel` już istnieje; VU pasek korzysta z `vuLevel`. Zweryfikuj, że w JSX paska używany jest `vuLevel` (nie `activeLevel`).
- Opcjonalnie zwiększ szerokość/opacity paska, ale najważniejsze: źródło danych to `vuLevel`.

## 6) Build i test
- Uruchom `npm run build` (powinien przejść po usunięciu duplikatów).
- Test manualny (tryb Experimental):
  1. Załaduj muzykę, ustaw FX (np. Mirror/Glitch/Neon) na Bass/Mid/High.
  2. Podnieś Depth/Wet.
  3. Obserwuj: pasek VU w slocie FX ma się ruszać; efekt wizualny ma pulsować w rytm pasma.

## Notatki
- Obecne problemy: brak dynamicznej reakcji FX i zamrożony pasek VU w slotach to skutek braku aktualizacji `fxVuLevels` i/lub przekazania `vuLevel` do `FxSlot`, plus za słaba modulacja w `computeFxVal`.
- Zmiany dotyczą tylko `App.tsx`, `ExperimentalApp.tsx`, `components/FxSlot.tsx`.
