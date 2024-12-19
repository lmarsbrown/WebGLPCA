

 
let xhr = new XMLHttpRequest()
xhr.open("GET","imgs.bin");
xhr.responseType = "arraybuffer";




xhr.onload = ()=>{
    window.images = new Uint8Array(xhr.response);
    main();
};
xhr.send();


let imageDatasetArr = new Float32Array(320*10304)

let datasetMatrix = new GPUMatrix(320,10304)
let transposeTemp = new GPUMatrix(10304,320);

let UBuffer1 = new GPUMatrix(320,10304);
let UBuffer2 = new GPUMatrix(320,10304);
let S = new GPUMatrix(320,320);


let VBuffer1 = new GPUMatrix(320,320);
let VBuffer2 = new GPUMatrix(320,320);
let vVec1 = new GPUMatrix(1,320);
let vVec2 = new GPUMatrix(1,320);

let averageMat = new GPUMatrix(1,320);
let averageMatData = new Float32Array(320);
for(let i = 0; i < averageMatData.length; i++)
{
    averageMatData[i] = 1/320;
}
averageMat.write(averageMatData);

let averageImage = new GPUMatrix(1,10304);


let reconstructedImages = new GPUMatrix(320,10304)

function main()
{
    for(let i = 0; i < images.length; i++)
    {
        imageDatasetArr[i] = images[i]/255;
    }
    datasetMatrix.write(imageDatasetArr);

    transposeMat(datasetMatrix,transposeTemp);
    matMul(transposeTemp,datasetMatrix,VBuffer1);

    for(let i = 0; i < 320; i++)
    {
        calcBiggestEigen(VBuffer1,VBuffer2,vVec1,vVec2);
    }

    let VData = new Float32Array(320*320);
    let SInvData = new Float32Array(320*320);
    for(let i = 0; i < 320; i++)
    {
        SInvData[i+i*320] = 1/eigenvals[i];
    }

    for(let y = 0; y < 320; y++)
    {
        for(let x = 0; x < 320; x++)
        {
            VData[x+320*y] = eigenvectors[y][x];
        }
    }
    VBuffer1.write(VData);
    transposeMat(VBuffer1,VBuffer2);
    matMul(datasetMatrix,VBuffer2,UBuffer2);

    S.write(SInvData);
    matMul(UBuffer2,S,UBuffer1);   
}


let SData = new Float32Array(320*320);

function reconstructImages(eigencount)
{
    for(let i = 0; i < 320; i++)
    {
        if(i < eigencount)
        {
            SData[i+i*320] = eigenvals[i];
        }
        else
        {
            SData[i+i*320] = 0;
        }
    }
    S.write(SData);
    matMul(UBuffer1,S,UBuffer2);   
    matMul(UBuffer2,VBuffer1,reconstructedImages);
    reconstructedImages.read();
}

// let size = 300;
// let test1Mat = new GPUMatrix(size,size);
// let test2Mat = new GPUMatrix(size,size);
// let test3Mat = new GPUMatrix(size,size);

// let testMatData1 = new Float32Array(size*size);
// for(let y = 0; y < size; y++)
// {
//     for(let x = 0; x < size; x++)
//     {
//         let val1 = Math.random()*2-1;
//         testMatData1[x+y*size] = val1;
//     }
// }
// test2Mat.write(testMatData1);
// // test2Mat.write(testMatData2);

// transposeMat(test2Mat,test1Mat);
// matMul(test1Mat,test2Mat,test3Mat);

// test3Mat.read();
// test3Mat.logBuffer();


// let v1 = new GPUMatrix(1,size);
// let v2 = new GPUMatrix(1,size);

// let startVecData = new Float32Array(size)
// for(let i = 0; i < startVecData.length; i++)
// {
//     startVecData[i] = Math.random()*2-1;
// }
// v1.write(startVecData);

let eigenvectors = [];
let eigenvals = [];

let pNorm = 0;


function calcBiggestEigen(mat,bufferMat,vec1,vec2)
{
    let startVecData = new Float32Array(vec1.height);
    for(let i = 0; i < startVecData.length; i++)
    {
        startVecData[i] = Math.random()*2-1;
    }

    vec1.write(startVecData);

    for(let i = 0; i < 10000; i++)
    {    
        matMul(mat,vec1,vec2);
    
        let buffer = vec2.read();
    
        let norm = 0;
        for(let i = 0; i < buffer.length; i++)
        {
            norm+= buffer[i]**2;
        }
        norm = Math.sqrt(norm);
    
        for(let i = 0; i < buffer.length; i++)
        {
            buffer[i] /= norm;
        }
    
        let error = norm - pNorm ;
        // console.log(norm,(norm-pNorm));
        pNorm = norm;
    
        if(Math.abs(error)< 0.00001)
        {
            console.log("eigenval: "+norm)
            eigenvectors.push(vec1.readCol(0));
            eigenvals.push(norm);
            orthogonalizeMatrix(norm,mat,vec1,bufferMat);
            copyMat(bufferMat,mat);


            
            return;
        }
        vec1.write(buffer);
        
    }
    debugger;

}


// let currentEigen = 0;

// let totalShift = 0;
// for(let i = 0; i < 10000; i++)
// {

//     matMul(test4Mat,test4Mat,test1Mat);
//     copyMat(test4Mat,test2Mat);

//     gaussianElimination(test1Mat,test2Mat,test3Mat);

//     matMul(test2Mat,test4Mat,test1Mat);
//     test1Mat.read()
//     test1Mat.logBuffer();

//     transposeMat(test2Mat,test3Mat)
    
//     matMul(test1Mat,test3Mat,test4Mat);

//     let lastEigen = test2Mat.readCell(size-1-currentEigen,size-1-currentEigen);
//     // console.log("lastEigen: "+lastEigen)

//     // test4Mat.read();
//     // test4Mat.logBuffer();
    
//     let lastCol = test4Mat.readCol(size-1-currentEigen);
//     let maxVal = 0;
//     for(let i = 0; i < size; i++)
//     {
//         if(Math.abs(lastCol[i]) > maxVal && i != size-1-currentEigen)
//         {
//             maxVal = Math.abs(lastCol[i]);
//         }
//     }
//     let doIncrease = 0;
//     if(maxVal < 0.001)
//     {
//         currentEigen++;
//         doIncrease = 1;
//         lastEigen = 0;
//         if(currentEigen >= size)
//         {
//             debugger;
//             break;
//         }
//     }

//     // shiftMat(-doIncrease *totalShift -lastEigen,test2Mat,test4Mat);
//     totalShift += -lastEigen;

//     console.log("maxVal: "+maxVal+", currentEigen: "+currentEigen)

//     // if(i%50 == 0)
//     // {
//     //     test4Mat.read();
//     //     test4Mat.logBuffer();
//     // }



//     // test3Mat.read();
//     // test3Mat.logBuffer()

//     // // matMul(test3Mat,test3Mat,test1Mat);

//     // let tmp = test2Mat;
//     // test2Mat = test3Mat;
//     // test3Mat = tmp;
// }


/*
QR QR QR
Q RQ RQ R

Q Q1R1  Q1R1 R
Q Q1 R1Q1 R1 R

Q Q1 Q2R2 R1 R

*/



let displayCan = document.createElement("canvas");
displayCan.width = 92 * 20;
displayCan.height = 112 * 16;
document.body.appendChild(displayCan);
let ctx = displayCan.getContext("2d");


const imgWidth = 92;
const imgHeight = 112;

ctx.clearRect(0,0,displayCan.width,displayCan.height);


/*
MSE 320 = 0.000013809501389646289
MSE 200 = 0.0007443740382428513 
MSE 100 = 0.002311844914168199 
MSE 50 =  0.004169087352125616 
MSE 10 = 0.009621179564155043 
*/

function drawImages(matrix)
{
    let MSE = 0;
    for(let y = 0; y < 16; y++)
    {
        for(let x = 0; x < 20; x++)
        {
            let i = x + y * 20;
            MSE += drawImage(matrix,i,x*imgWidth,y*imgHeight);
        }
    }
    return MSE/(16*20);
}
function drawImage(matrix,imageNum,xOffset,yOffset)
{

    let maxVal = 0;
    let minVal = 0;

    let MSE = 0;
    for(let y = 0; y < imgHeight; y++)
    {
        for(let x = 0; x < imgWidth; x++)
        {
            let i = (y+x*imgHeight)*320+imageNum;
            let val = matrix.cpuBuffer[i];
            let origVal = datasetMatrix.cpuBuffer[i];
            if(val>maxVal)
            {
                maxVal = val;
            }
            if(val<minVal)
            {
                minVal = val;
            }
            MSE += (val-origVal)**2;
        }
    }
    MSE /= imgWidth*imgHeight;

    for(let y = 0; y < imgHeight; y++)
    {
        for(let x = 0; x < imgWidth; x++)
        {
            let i = (y+x*imgHeight)*320+imageNum;
            let val = (matrix.cpuBuffer[i]-minVal)/(maxVal-minVal)*255;
            // let val = (matrix.cpuBuffer[i])*255;
            ctx.fillStyle = `rgb(${val},${val},${val})`;
            ctx.fillRect(x+xOffset,y+yOffset,1,1);
        }
    }
    return MSE;
}

// const size = 2000;
// let randMat = new GPUMatrix(size,size);
// let transMat = new GPUMatrix(size,size);
// let symMat = new GPUMatrix(size,size);

// let v1 = new GPUMatrix(1,size);
// let v2 = new GPUMatrix(1,size);

// let matData = new Float32Array(size*size);
// for(let i = 0; i < matData.length; i++)
// {
//     matData[i] = Math.random()*2-1;
// }
// randMat.write(matData);
// transposeMat(randMat,transMat);
// matMul(randMat,transMat,symMat);

// symMat.read();
// symMat.logBuffer();

// let startVecData = new Float32Array(size)
// for(let i = 0; i < startVecData.length; i++)
// {
//     startVecData[i] = Math.random()*2-1;
// }
// v1.write(startVecData);


// let pNorm = 0;

// for(let i = 0; i < 100; i++)
// {    
//     matMul(symMat,v1,v2);

//     let buffer = v2.read();

//     let norm = 0;
//     for(let i = 0; i < buffer.length; i++)
//     {
//         norm+= buffer[i]**2;
//     }
//     norm = Math.sqrt(norm);

//     for(let i = 0; i < buffer.length; i++)
//     {
//         buffer[i] /= norm;
//     }

//     console.log(norm,(norm-pNorm)/norm);
//     pNorm = norm;

//     v1.write(buffer);
// }


