precision highp float;

varying vec3 fNormal;

uniform vec3 uColor; 

void main() {
    
   gl_FragColor = vec4(
    uColor.x *0.9 + fNormal.x*0.25, 
    uColor.y *0.9 + fNormal.y*0.25, 
    uColor.z *0.9 + fNormal.z*0.25,
    1.0);
    
  //gl_FragColor = vec4(uColor,1.0);
}