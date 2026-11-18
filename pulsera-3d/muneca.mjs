import * as THREE from 'three';

// Mano de referencia, modelada en las mismas unidades que la correa.
// Cada sección indica altura, centro X/Z y los dos radios de la elipse.
export function crearMuneca() {
  const mano = new THREE.Group();
  const acabado = color => new THREE.MeshStandardMaterial({ color, roughness:.88 });
  const piel = acabado(0xb58366), tela = acabado(0x324859), puno = acabado(0x405967);
  function volumen(filas, material) {
    const pos = [], indices = [], n = 32;
    for (const [y,x,z,rx,rz] of filas) {
      for (let j=0; j<n; j++) {
        const a = 2 * Math.PI * j/n;
        pos.push(x + rx*Math.cos(a), y, z + rz*Math.sin(a));
      }
    }
    for (let i=0; i<filas.length-1; i++) for (let j=0; j<n; j++) {
      const a=i*n+j, b=i*n+(j+1)%n;
      indices.push(a,a+n,b+n,a,b+n,b);
    }
    // Cerrar también los extremos visibles al girar el maniquí.
    const last=(filas.length-1)*n;
    for (let j=1;j<n-1;j++) indices.push(0,j,j+1,last,last+j+1,last+j);
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
    geo.setIndex(indices); geo.computeVertexNormals();
    mano.add(new THREE.Mesh(geo,material));
  }
  volumen([[-86,0,1,35,28],[-50,0,2,31,26],[-17,0,3,28,24],[0,0,3,27,24],[11,0,3,28,22],[24,-1,1,34,19],[40,-2,0,38,15],[55,-2,-2,36,12],[62,-1,-4,32,9],[66,0,-5,28,5]],piel);
  // Los dedos se relajan hacia la palma; el pulgar se abre hacia el costado.
  for (const [x,base,largo,r,abanico] of [[-27,55,43,8,-.08],[-10,59,50,8.7,-.025],[8,58,46,8,.05],[24,53,36,7,.12]]) {
    volumen([[base-5,x,-3,r,9],[base+5,x,-3,r,8],[base+largo*.48,x+largo*abanico*.5,-5,r*.89,7],[base+largo*.77,x+largo*abanico,-9,r*.78,6],[base+largo-3,x+largo*abanico,-12,r*.65,4.7],[base+largo,x+largo*abanico,-13,r*.25,2]],piel);
  }
  volumen([[18,-23,-1,9,12],[29,-30,-2,13,13],[39,-39,-4,11,11],[49,-47,-7,9,9],[59,-51,-11,7,7],[64,-52,-13,3,3]],piel);
  volumen([[-105,0,0,40,33],[-93,0,0,40,33],[-72,0,0,36,30],[-50,0,1,34,28]],tela);
  volumen([[-57,0,1,35,29],[-54,0,1,36,29.5],[-41,0,2,33,28],[-39,0,2,31.7,27]],puno);
  return mano;
}
