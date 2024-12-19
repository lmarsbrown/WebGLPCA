 #include <zlib.h>
#include <stdio.h>
#include <stdlib.h>

 int main()
 {
    int length = 1024*1024*16;
    u_int8_t *buffer = malloc(length);
    FILE *ptr = fopen("facesOlivetti.mat","rb");

    fread(buffer,length,1,ptr);
    fclose(ptr);

    int compressedBytes = *(u_int32_t*)(buffer+128+4);

    Bytef *uncompressedData = malloc(length*10);
    uLongf destLen;

    //10304 is image size
    //is encoded as doubles for some reason
    //26378240 = 10304*320*8;
    int status = uncompress(uncompressedData,&destLen,(buffer+128+2*4),length);

    int elems = 10304*320;
    u_int8_t *outArray = malloc(elems);
    for(int i = 0; i <  elems; i++)
    {
        outArray[i] = 255.0*((double*)(uncompressedData))[i+8];
        // printf("%u, ",outArray[i]);
    }
    printf("\n");
    FILE *outPtr = fopen("imgs.bin","wb");
    fwrite(outArray,sizeof(u_int8_t),elems,outPtr);
    fclose(outPtr);

    // printf("%i,\n",((u_int32_t*)(uncompressedData))[0]);

    return 0;
 }