(* LV16: simulacija logike, bez fizickog motora i sigurnosnog PLC-a. *)

(* Novi pritisak postoji samo ako je Start sada TRUE, a prije je bio FALSE. *)
StartEdge := Start AND NOT StartOld;
StartOld := Start;

(* Nedostatak bilo kojeg dopustenja ima prednost pred zahtjevom za start. *)
IF NOT StopOK OR NOT ProtectionOK THEN
    Motor := FALSE;
ELSIF StartEdge THEN
    Motor := TRUE;
END_IF;

(* Bez nove promjene Motor pamti stanje. Povratak dopustenja nije start:
   nakon njega treba otpustiti START i ponovno ga pritisnuti. *)
