#pragma once
#include <stddef.h>
#ifdef __cplusplus
extern "C" {
#endif
size_t strlen(const char*);
void* memcpy(void*,const void*,size_t);
void* memmove(void*,const void*,size_t);
void* memset(void*,int,size_t);
int memcmp(const void*,const void*,size_t);
int strcmp(const char*,const char*);
#ifdef __cplusplus
}
#endif
