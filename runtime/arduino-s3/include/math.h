#pragma once
#ifdef __cplusplus
extern "C" {
#endif
double sqrt(double);
double pow(double,double);
double log(double);
double exp(double);
double sin(double);
double cos(double);
double floor(double);
double ceil(double);
double round(double);
double fabs(double);
#ifdef __cplusplus
}
#endif
#define isnan(x) __builtin_isnan(x)
#define isfinite(x) __builtin_isfinite(x)
#define NAN __builtin_nan("")
