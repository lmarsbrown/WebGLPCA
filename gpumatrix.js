class GPUMatrix 
{
    constructor(width,height)
    {
        this.tex = createTexture(width,height,null);
        
        this.tex_fb = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER,this.tex_fb);
        gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,this.tex,0);
        gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
        gl.bindFramebuffer(gl.FRAMEBUFFER,null);

        this.width = width;
        this.height = height;

        this._buffer = new Float32Array(this.width*this.height*4);
        this.cpuBuffer = new Float32Array(this.width*this.height);
    }
    write(array)
    {
        for(let i = 0; i < this.width*this.height; i++)
        {
            this._buffer[i*4] = array[i];
        }
        write_to_tex(this.tex,this._buffer,this.width,this.height);
    }
    read()
    {

        gl.bindFramebuffer(gl.FRAMEBUFFER,this.tex_fb)
        gl.readPixels(0,0,this.width,this.height,gl.RGBA,gl.FLOAT,this._buffer);

        for(let i = 0; i < this.width*this.height; i++)
        {
            this.cpuBuffer[i] = this._buffer[i*4];
        }
        return this.cpuBuffer;
    }
    readCol(col)
    {
        gl.bindFramebuffer(gl.FRAMEBUFFER,this.tex_fb)
        gl.readPixels(col,0,1,this.height,gl.RGBA,gl.FLOAT,this._buffer);

        let out = new Float32Array(this.height);
        for(let i = 0; i < this.height; i++)
        {
            out[i] = this._buffer[i*4];
        }
        return out;
    }
    readCell(x,y)
    {
        gl.bindFramebuffer(gl.FRAMEBUFFER,this.tex_fb)
        gl.readPixels(x,y,1,1,gl.RGBA,gl.FLOAT,this._buffer);
        return this._buffer[0];
    }
    logBuffer(digits=3)
    {
        let out = "";
        for(let y = 0; y < this.height; y++)
        {
            let line = "";
            for(let x = 0; x < this.width; x++)
            {
                let val = this.cpuBuffer[x+y*this.width];
                val = Math.trunc(val*10**digits)/10**digits;

                let figs = digits-((Math.abs(val)+"").length-2);

                if(val == 0)
                {
                    val+=".";
                    figs = digits;
                }
                
                for(let i = 0; i < figs; i++)
                {
                    val=(val+"").concat("0");
                }

                if(val>=0)
                {
                    line += " " + val+", ";
                }
                else
                {
                    line += val+", ";
                }
            }   
            out += line+"\n";
        }
        console.log(out);
    }
    isSquare()
    {
        return this.width = this.height;
    }
    sameSize(input)
    {
        return this.width == input.width && this.height == input.height;
    }
}

const width = 1;
const height = 1;

const x_resolution = width;
const y_resolution = height;

let can = document.createElement("canvas");
can.width = width;
can.height = height;


var gl = can.getContext("webgl2");
if (!gl.getExtension('EXT_color_buffer_float'))
    throw new Error('Rendering to floating point textures is not supported on this platform');

var multiplyProgram = createShaderProgram(generic_vs_code,
    `#version 300 es
    precision highp float;
    in vec2 v_position;

    uniform ivec2 outSize;
    uniform int inSize;

    uniform sampler2D input_tex0;
    uniform sampler2D input_tex1;

    out vec4 FragColor;
    
    void main()
    {
        int ix = int(0.5*(v_position.x+1.0)*float(outSize.x));
        int iy = int(0.5*(v_position.y+1.0)*float(outSize.y));

        float outVal = 0.0;

        for(int i = 0; i < inSize; i++)
        {
            outVal += texelFetch(input_tex0,ivec2(i,iy),0).r * texelFetch(input_tex1,ivec2(ix,i),0).r;
        }

        FragColor = vec4(outVal,0.0,0.0,1.0);
    }
    `
);

let mulTex0Loc = gl.getUniformLocation(multiplyProgram,"input_tex0");
let mulTex1Loc = gl.getUniformLocation(multiplyProgram,"input_tex1");
gl.useProgram(multiplyProgram);
gl.uniform1i(mulTex0Loc,0)
gl.uniform1i(mulTex1Loc,1)

let mulInSizeLoc = gl.getUniformLocation(multiplyProgram,"inSize");
let mulOutSizeLoc = gl.getUniformLocation(multiplyProgram,"outSize");




var orthogonalizeProgram = createShaderProgram(generic_vs_code,
    `#version 300 es
    precision highp float;
    in vec2 v_position;

    uniform ivec2 size;
    uniform float eigenvalue;

    uniform sampler2D input_tex0;
    uniform sampler2D input_tex1;

    out vec4 FragColor;
    
    void main()
    {
        int ix = int(0.5*(v_position.x+1.0)*float(size.x));
        int iy = int(0.5*(v_position.y+1.0)*float(size.y));

        float outVal = texelFetch(input_tex0,ivec2(ix,iy),0).r - eigenvalue * texelFetch(input_tex1,ivec2(0,ix),0).r*texelFetch(input_tex1,ivec2(0,iy),0).r;

        FragColor = vec4(outVal,0.0,0.0,1.0);
    }
    `
);

let orthoTex0Loc = gl.getUniformLocation(orthogonalizeProgram,"input_tex0");
let orthoTex1Loc = gl.getUniformLocation(orthogonalizeProgram,"input_tex1");
gl.useProgram(orthogonalizeProgram);
gl.uniform1i(orthoTex0Loc,0)
gl.uniform1i(orthoTex1Loc,1)

let orthoSizeLoc = gl.getUniformLocation(orthogonalizeProgram,"size");
let orthoEigenLoc = gl.getUniformLocation(orthogonalizeProgram,"eigenvalue");


var gaussElimProgram = createShaderProgram(generic_vs_code,
    `#version 300 es
    precision highp float;
    in vec2 v_position;

    uniform ivec2 size;
    uniform int column;

    uniform sampler2D input_tex0;
    uniform sampler2D input_tex1;

    out vec4 FragColor;
    
    void main()
    {
        int ix = int(0.5*(v_position.x+1.0)*float(size.x));
        int iy = int(0.5*(v_position.y+1.0)*float(size.y));
        
        float outVal = 0.0;
        if(iy > column)
        {
            float scalar = texelFetch(input_tex0,ivec2(column,iy),0).r/texelFetch(input_tex0,ivec2(column,column),0).r;
            outVal = texelFetch(input_tex1,ivec2(ix,iy),0).r - texelFetch(input_tex1,ivec2(ix,column),0).r * scalar;
        }
        else if(iy == column)
        {
            float scalar = 1.0/texelFetch(input_tex0,ivec2(column,column),0).r;
            outVal = texelFetch(input_tex1,ivec2(ix,column),0).r * sqrt(abs(scalar))*sign(scalar);
        }
        else
        {
            outVal = texelFetch(input_tex1,ivec2(ix,iy),0).r;
        }



        FragColor = vec4(outVal,0.0,0.0,1.0);
    }
    `
);
let elimTex0Loc = gl.getUniformLocation(gaussElimProgram,"input_tex0");
let elimTex1Loc = gl.getUniformLocation(gaussElimProgram,"input_tex1");
gl.useProgram(gaussElimProgram);
gl.uniform1i(elimTex0Loc,0)
gl.uniform1i(elimTex1Loc,1)

let elimSizeLoc = gl.getUniformLocation(gaussElimProgram,"size");
let elimColLoc = gl.getUniformLocation(gaussElimProgram,"column");



var transposeProgram = createShaderProgram(generic_vs_code,
    `#version 300 es
    precision highp float;
    in vec2 v_position;

    uniform ivec2 outSize;

    uniform sampler2D input_tex0;

    out vec4 FragColor;
    
    void main()
    {
        int ix = int(0.5*(v_position.x+1.0)*float(outSize.x));
        int iy = int(0.5*(v_position.y+1.0)*float(outSize.y));

        FragColor =  texelFetch(input_tex0,ivec2(iy,ix),0);
    }
    `
)

let transposeOutSizeLoc = gl.getUniformLocation(transposeProgram,"outSize");

var copyProgram = createShaderProgram(generic_vs_code,
    `#version 300 es
    precision highp float;
    in vec2 v_position;

    uniform ivec2 size;

    uniform sampler2D input_tex0;

    out vec4 FragColor;
    
    void main()
    {
        int ix = int(0.5*(v_position.x+1.0)*float(size.x));
        int iy = int(0.5*(v_position.y+1.0)*float(size.y));

        FragColor =  texelFetch(input_tex0,ivec2(ix,iy),0);
    }
    `
)
let copySizeLoc = gl.getUniformLocation(copyProgram,"size");

var shiftProgram = createShaderProgram(generic_vs_code,
    `#version 300 es
    precision highp float;
    in vec2 v_position;

    uniform ivec2 size;
    uniform float shift;

    uniform sampler2D input_tex0;

    out vec4 FragColor;
    
    void main()
    {
        int ix = int(0.5*(v_position.x+1.0)*float(size.x));
        int iy = int(0.5*(v_position.y+1.0)*float(size.y));
        float addShift = 0.0;
        if(ix==iy)
        {
            addShift = shift;
        }

        FragColor =  texelFetch(input_tex0,ivec2(ix,iy),0)+vec4(addShift,0.0,0.0,0.0);
    }
    `
)
let shiftSizeLoc = gl.getUniformLocation(shiftProgram,"size");
let shiftShiftLoc = gl.getUniformLocation(shiftProgram,"shift");

var pivotProgram = createShaderProgram(generic_vs_code,
    `#version 300 es
    precision highp float;
    in vec2 v_position;

    uniform ivec2 size;

    uniform int n;
    uniform int k;

    uniform sampler2D input_tex0;

    out vec4 FragColor;
    
    void main()
    {
        int ix = int(0.5*(v_position.x+1.0)*float(size.x));
        int iy = int(0.5*(v_position.y+1.0)*float(size.y));

        if(iy == n)
        {
            iy = k;
        }
        else if(iy == k)
        {
            iy = n;
        }
        vec4 outVal = texelFetch(input_tex0,ivec2(ix,iy),0);

        FragColor = outVal;
    }
    `
)
let pivotSizeLoc = gl.getUniformLocation(pivotProgram,"size");
let pivotNLoc = gl.getUniformLocation(pivotProgram,"n");
let pivotKLoc = gl.getUniformLocation(pivotProgram,"k");

create_quad(multiplyProgram)



/**
 * 
 * @param {GPUMatrix} input1 
 * @param {GPUMatrix} input2 
 * @param {GPUMatrix} output 
 */
function matMul(input1, input2, output)
{
    if(input1.width != input2.height)
    {
        throw "Input Matrix Size Mismatch";
    }
    if(input1.height != output.height || input2.width != output.width)
    {
        throw "Output Matrix Size Mismatch";
    }
    
    gl.viewport(0,0,output.width,output.height)
    gl.useProgram(multiplyProgram);

    gl.uniform2i(mulOutSizeLoc,output.width,output.height);
    gl.uniform1i(mulInSizeLoc,input1.width);
    
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D,input1.tex);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D,input2.tex)

    gl.bindFramebuffer(gl.FRAMEBUFFER,output.tex_fb);
    gl.drawArrays(gl.TRIANGLES,0,3);
}

/**
 * 
 * @param {GPUMatrix} input1 
 * @param {GPUMatrix} input2 
 * @param {GPUMatrix} output 
 */
function orthogonalizeMatrix(eigenvalue,input1, input2, output)
{
    if(input1.width != input2.height)
    {
        throw "Input Matrix Size Mismatch";
    }
    // if(input1.height != output.height || input2.width != output.width)
    // {
    //     throw "Output Matrix Size Mismatch";
    // }
    
    gl.viewport(0,0,output.width,output.height)
    gl.useProgram(orthogonalizeProgram);

    gl.uniform2i(orthoSizeLoc,output.width,output.height);
    gl.uniform1f(orthoEigenLoc,eigenvalue);
    
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D,input1.tex);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D,input2.tex)

    gl.bindFramebuffer(gl.FRAMEBUFFER,output.tex_fb);
    gl.drawArrays(gl.TRIANGLES,0,3);
}

/**
 * 
 * @param {GPUMatrix} input1 
 * @param {GPUMatrix} input2 
 * @param {GPUMatrix} output 
 */
function gaussianEliminationStep(col,input1, input2, output)
{
    if(!input1.isSquare())
    {
        throw "Input Not Square";
    }

    if(!input1.sameSize(input2))
    {
        throw "Input Matrix Size Mismatch";
    }
    if(!input1.sameSize(output))
    {
        throw "Output Matrix Size Mismatch";
    }
    
    gl.viewport(0,0,output.width,output.height)
    gl.useProgram(gaussElimProgram);

    gl.uniform2i(elimSizeLoc,output.width,output.height);
    gl.uniform1i(elimColLoc,col);
    
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D,input1.tex);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D,input2.tex)

    gl.bindFramebuffer(gl.FRAMEBUFFER,output.tex_fb);
    gl.drawArrays(gl.TRIANGLES,0,3);
}

function gaussianElimination(input1, input2,buffer)
{
    if(!input1.isSquare())
    {
        throw "Input Not Square";
    }

    if(!input1.sameSize(input2))
    {
        throw "Input Matrix Size Mismatch";
    }
    if(!input1.sameSize(buffer))
    {
        throw "Output Matrix Size Mismatch";
    }
    

    let mat1 = input1;
    let mat2 = input2;
    let mat3 = buffer;
    for(let i = 0; i < input1.width; i++)
    {
        let currentCol = mat1.readCol(i);
        let bestVal = currentCol[i];

        let bestJ = i;

        for(let j = 0; j < i+1; j++)
        {
            if(isNaN(currentCol[j]))
            {
                debugger;
            }
        }
        for(let j = i+1; j < input1.width; j++)
        {
            if(isNaN(currentCol[j]))
            {
                debugger;
            }
            if(Math.abs(bestVal)<Math.abs(currentCol[j]))
            {
                bestVal = currentCol[j];
                bestJ = j;
            }
        }
        if(Math.abs(bestVal) < 0.0001)
        {
            continue;
        }
        if(bestJ != i)
        {
            pivotMat(i,bestJ,mat1,mat3);
            copyMat(mat3,mat1);

            pivotMat(i,bestJ,mat2,mat3);
            copyMat(mat3,mat2);
        }

        gaussianEliminationStep(i,mat1,mat2,mat3);
        let tmp = mat2;
        mat2 = mat3;
        mat3 = tmp;


        gaussianEliminationStep(i,mat1,mat1,mat3);
        mat3.read()
        mat3.logBuffer();
        // debugger;
        tmp = mat1;
        mat1 = mat3;
        mat3 = tmp;
    }
    if(mat1 == buffer)
    {
        copyMat(mat2,mat3);
        copyMat(mat1,mat2);
    }
    if(mat1 == input2)
    {
        copyMat(mat1,mat3);
        copyMat(mat2,mat1);
    }
}
/*
1 2 3
3 1 2
2 3 1
*/

/**
 * 
 * @param {GPUMatrix} input 
 * @param {GPUMatrix} output 
 */
function transposeMat(input,output)
{
    if(input.width != output.height || input.height != output.width)
    {
        throw "Input Matrix Size Mismatch";
    }
    gl.viewport(0,0,output.width,output.height)
    gl.useProgram(transposeProgram);    

    gl.uniform2i(transposeOutSizeLoc,output.width,output.height);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D,input.tex);
    gl.bindFramebuffer(gl.FRAMEBUFFER,output.tex_fb);
    gl.drawArrays(gl.TRIANGLES,0,3);
}

/**
 * 
 * @param {GPUMatrix} input 
 * @param {GPUMatrix} output 
 */
function copyMat(input,output)
{
    if(!input.sameSize(output))
    {
        throw "Input Matrix Size Mismatch";
    }

    gl.viewport(0,0,output.width,output.height)
    gl.useProgram(copyProgram);    

    gl.uniform2i(copySizeLoc,output.width,output.height);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D,input.tex);
    gl.bindFramebuffer(gl.FRAMEBUFFER,output.tex_fb);
    gl.drawArrays(gl.TRIANGLES,0,3);
}

/**
 * 
 * @param {GPUMatrix} input 
 * @param {GPUMatrix} output 
 */
function pivotMat(n,k,input,output)
{
    if(!input.sameSize(output))
    {
        throw "Input Matrix Size Mismatch";
    }

    gl.viewport(0,0,output.width,output.height)
    gl.useProgram(pivotProgram);    

    gl.uniform2i(pivotSizeLoc,output.width,output.height);
    gl.uniform1i(pivotNLoc,n);
    gl.uniform1i(pivotKLoc,k);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D,input.tex);
    gl.bindFramebuffer(gl.FRAMEBUFFER,output.tex_fb);
    gl.drawArrays(gl.TRIANGLES,0,3);
}

/**
 * @param {Number} shift 
 * @param {GPUMatrix} input 
 * @param {GPUMatrix} output 
 */
function shiftMat(shift,input,output)
{
    if(!input.sameSize(output))
    {
        throw "Input Matrix Size Mismatch";
    }

    gl.viewport(0,0,output.width,output.height)
    gl.useProgram(shiftProgram);    

    gl.uniform2i(shiftSizeLoc,output.width,output.height);
    gl.uniform1f(shiftShiftLoc,shift);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D,input.tex);
    gl.bindFramebuffer(gl.FRAMEBUFFER,output.tex_fb);
    gl.drawArrays(gl.TRIANGLES,0,3);
}


/*

2 5 2
8 3 1
6 3 5

2     ,  5      , 2
6     , -2     , -1
3.7575, -2.6060,  2.7575

33 33 37
0  41 25
0  25 28.5151

33 33 37
33 74 62
37 62 70

*/