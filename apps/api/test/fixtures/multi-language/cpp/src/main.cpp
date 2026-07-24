#include <cstdio>
#include <cstdlib>

void allocate(int count, int size) {
    char output[8];
    sprintf(output, "%d", count);
    malloc(count * size);
}
