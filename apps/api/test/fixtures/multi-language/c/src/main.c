#include <stdio.h>
#include <string.h>

void copy(char *input) {
    char target[8];
    strcpy(target, input);
    scanf("%s", target);
}
