import {THREE} from './kit.mjs';

// Low-detail meshes are baked from the supplied rig, never substituted with a new character.
// Spatial clustering reduces tiny surface details while retaining the original silhouette.
const cache=new Map();
const solidMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.8});
function clustered(meshes,cell){
  const vertices=[],indices=[],lookup=new Map(),point=new THREE.Vector3(),color=new THREE.Color();
  for(const m of meshes){const g=m.geometry,position=g.attributes.position,colors=g.attributes.color,index=g.index;const count=index?index.count:position.count;
    for(let triangle=0;triangle<count;triangle+=3){const face=[];
      for(let corner=0;corner<3;corner++){const j=index?index.getX(triangle+corner):triangle+corner;point.fromBufferAttribute(position,j).applyMatrix4(m.matrixWorld);color.copy(m.material.color||new THREE.Color('white'));if(colors&&m.material.vertexColors)color.multiply(new THREE.Color(colors.getX(j),colors.getY(j),colors.getZ(j)));
        const key=[Math.round(point.x/cell),Math.round(point.y/cell),Math.round(point.z/cell),Math.round(color.r*15),Math.round(color.g*15),Math.round(color.b*15)].join(',');let at=lookup.get(key);if(at===undefined){at=vertices.length;lookup.set(key,at);vertices.push([point.x,point.y,point.z,color.r,color.g,color.b]);}face.push(at);
      }if(new Set(face).size===3)indices.push(...face);
    }
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices.flatMap(v=>v.slice(0,3)),3));g.setAttribute('color',new THREE.Float32BufferAttribute(vertices.flatMap(v=>v.slice(3)),3));g.setIndex(indices);g.computeVertexNormals();g.computeBoundingSphere();return g;
}
export function bakeLevels(rig,key){
  if(!cache.has(key)){
    rig.update(.016,0);rig.root.updateMatrixWorld(true);const solid=[],transparent=[];
    rig.root.traverse(n=>{if(!n.isMesh||!n.geometry.attributes.position?.count)return;for(let p=n;p;p=p.parent)if(!p.visible)return;if(n.material.transparent){if(n.material.map)transparent.push(n);}else solid.push(n);});
    const levels=[.027,.055].map(cell=>{const root=new THREE.Group();root.add(new THREE.Mesh(clustered(solid,cell),solidMaterial));for(const original of transparent){if(cell>.04&&original!==rig._rig.eyesMesh&&original!==rig._rig.shadow)continue;const geo=original.geometry.clone().applyMatrix4(original.matrixWorld),material=original.material.clone();if(material.map)material.map=material.map.clone();root.add(new THREE.Mesh(geo,material));}return root;});cache.set(key,levels);
  }
  return cache.get(key).map(root=>root.clone());
}
