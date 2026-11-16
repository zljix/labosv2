#include <stdio.h>
#include <string.h>
#include "u8g2.h"
uint8_t dummy(u8x8_t *u,uint8_t m,uint8_t a,void *p){return 1;}
int main(){u8g2_t u; u8g2_Setup_ssd1306_i2c_128x64_noname_f(&u,U8G2_R0,dummy,dummy);u8g2_SetFont(&u,u8g2_font_6x10_tf);printf("{");char *cs="0123456789.-";for(int i=0;cs[i];i++){u8g2_ClearBuffer(&u);u8g2_DrawGlyph(&u,0,8,cs[i]);uint8_t *b=u8g2_GetBufferPtr(&u);printf("%s\"%c\":[",i?",":"",cs[i]);for(int x=0;x<6;x++){unsigned col=0;for(int y=0;y<10;y++)if(b[(y/8)*128+x]&(1<<(y%8)))col|=1<<y;printf("%s%u",x?",":"",col);}printf("]");}puts("}");}
