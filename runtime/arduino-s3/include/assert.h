// MIT. Failed library assertions use the same terminating API error path.
#pragma once
#ifdef __cplusplus
extern "C" {
#endif
void lab_fault(int);
#ifdef __cplusplus
}
#endif
#ifdef NDEBUG
#define assert(condition) ((void)0)
#else
#define assert(condition) ((condition) ? (void)0 : lab_fault(-22))
#endif
