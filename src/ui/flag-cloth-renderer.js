// A continuous, lit fabric mesh. All vertices share the same texture and normals.
export function createFlagClothRenderer(canvas) {
  const gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: false, preserveDrawingBuffer: true });
  if (!gl) return null;
  const vertex = `
    precision highp float;
    attribute vec2 uv;
    uniform float time;
    uniform float strength;
    varying vec2 fabricUV;
    varying vec3 normal;
    vec3 surface(vec2 p) {
      float u=p.x, v=p.y;
      float phase=7.3*u-1.8*time+1.2*v;
      float gust=.84+.16*sin(time*.63);
      float amplitude=pow(u,1.3)*strength*gust;
      float wave=sin(phase)+.23*sin(12.5*u-2.6*time+2.1*v);
      return vec3(
        65.-16.*v*(1.-u)+u*(110.+17.*v)+amplitude*7.*wave,
        70.+179.*v+u*(119.-35.*v)+10.*sin(3.14159*u)+amplitude*14.*wave,
        12.*sin(8.*u+.6*v)+amplitude*19.*wave
      );
    }
    void main() {
      fabricUV=uv;
      vec3 p=surface(uv);
      vec3 du=surface(uv+vec2(.001,0.))-p;
      vec3 dv=surface(uv+vec2(0.,.001))-p;
      normal=normalize(cross(du,dv));
      gl_Position=vec4(p.x/108.-1.,1.-p.y/220.,0.,1.);
    }
  `;
  const fragment = `
    precision highp float;
    uniform sampler2D textile;
    uniform float time;
    varying vec2 fabricUV;
    varying vec3 normal;
    void main() {
      vec2 p=fabricUV;
      bool fringe=p.x>1. || p.y>1.;
      vec3 n=normalize(normal);
      float diffuse=max(0.,dot(n,normalize(vec3(-.35,-.5,1.))));
      float shine=pow(max(0.,dot(n,normalize(vec3(-.25,-.35,1.)))),18.);
      vec3 color=texture2D(textile,clamp(p,0.,1.)).rgb;
      float edge=min(min(p.x,1.-p.x),min(p.y,1.-p.y));
      if(edge<.012) {
        color=mix(vec3(.46,.24,.055),vec3(.98,.75,.32),.5+.5*sin(edge*900.));
        shine*=1.6;
      }
      if(fringe) {
        float strand=p.y>1.?p.x*115.:p.y*145.;
        float length=p.y>1.?(p.y-1.)/.032:(p.x-1.)/.026;
        if(fract(strand)>.64 || length>.78+.22*sin(floor(strand)*17.)) discard;
        color=mix(vec3(.5,.3,.08),vec3(.95,.76,.4),fract(strand)*1.4);
      }
      float weave=.995+.005*sin(p.x*1500.)*sin(p.y*1900.);
      float fold=sin(11.5*p.x-1.8*time+.9*p.y)
        +.22*sin(22.*p.x-2.2*time+1.4*p.y);
      float silk=.63+.37*smoothstep(-.9,.8,fold);
      float satin=pow(max(0.,cos(11.5*p.x-1.8*time+.9*p.y)),10.)*.12;
      color=color*(.58+.43*diffuse)*weave*silk+(shine*.65+satin)*vec3(.19,.15,.095);
      gl_FragColor=vec4(color,1.);
    }
  `;
  function compile(type, source) {
    const shader=gl.createShader(type);
    gl.shaderSource(shader,source);
    gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  }
  const program=gl.createProgram();
  const vs=compile(gl.VERTEX_SHADER,vertex), fs=compile(gl.FRAGMENT_SHADER,fragment);
  gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  gl.deleteShader(vs);gl.deleteShader(fs);
  const columns=112, rows=64, vertices=[];
  for(let y=0;y<rows;y++) for(let x=0;x<columns;x++) {
    const a=x/columns*1.026, b=y/rows*1.032;
    const c=(x+1)/columns*1.026, d=(y+1)/rows*1.032;
    vertices.push(a,b,c,b,a,d,c,b,c,d,a,d);
  }
  const buffer=gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);
  const texture=gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D,texture);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  const location=gl.getAttribLocation(program,'uv');
  const timeUniform=gl.getUniformLocation(program,'time');
  const strengthUniform=gl.getUniformLocation(program,'strength');
  let loadedImage;
  return {
    draw(image,time,strength) {
      if(!image?.complete || !image.naturalWidth || gl.isContextLost()) return;
      gl.useProgram(program);
      gl.bindTexture(gl.TEXTURE_2D,texture);
      if(loadedImage!==image) {
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
        loadedImage=image;
      }
      gl.viewport(0,0,canvas.width,canvas.height);
      gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
      gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location,2,gl.FLOAT,false,0,0);
      gl.uniform1f(timeUniform,time);
      gl.uniform1f(strengthUniform,strength);
      gl.drawArrays(gl.TRIANGLES,0,vertices.length/2);
    },
    dispose() {
      gl.deleteTexture(texture);gl.deleteBuffer(buffer);gl.deleteProgram(program);
    },
  };
}
