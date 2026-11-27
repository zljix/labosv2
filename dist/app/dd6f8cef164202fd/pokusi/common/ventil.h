#pragma once
// Zasebna učenička biblioteka. Između pragova zadržava se prethodno stanje.
const float PRAG_OTVARANJA = 27.0;
const float PRAG_ZATVARANJA = 26.0;
float korekcija(float t, float pomak = 0.0) { return t + pomak; }
bool odluka(float temperatura, bool prethodno) {
  if (temperatura >= PRAG_OTVARANJA) return true;
  if (temperatura <= PRAG_ZATVARANJA) return false;
  return prethodno;
}
