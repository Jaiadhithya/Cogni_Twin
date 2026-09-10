'use client';

import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { EffectComposer, Bloom } from '@react-three/postprocessing';

const COUNT = 200;

class FlowCurve extends THREE.Curve<THREE.Vector3> {
  constructor() {
    super();
  }

  getPoint(t: number, optionalTarget = new THREE.Vector3()) {
    // Starts near camera (z = 30), travels into distance (z = -20), bends UP
    const startZ = 30;
    const bendRadius = 8;
    const bendStartZ = -20;
    
    const L_forward = startZ - bendStartZ; // 50 units
    const L_arc = (Math.PI * bendRadius) * 0.5;
    const L_up = 30; // 30 units UP
    
    const totalLength = L_forward + L_arc + L_up;
    const d = t * totalLength;
    
    let px = 0;
    let py = 0;
    let pz = 0;
    
    if (d <= L_forward) {
      // moving away (negative Z direction)
      py = 0;
      pz = startZ - d;
    } else if (d <= L_forward + L_arc) {
      // bending UP
      const arcD = d - L_forward;
      const angle = (arcD / L_arc) * (Math.PI * 0.5); // 0 to 90 deg
      
      // Z continues decreasing from bendStartZ
      pz = bendStartZ - bendRadius * Math.sin(angle);
      // Y increases from 0
      py = bendRadius * (1 - Math.cos(angle));
    } else {
      // moving UP
      const upD = d - L_forward - L_arc;
      pz = bendStartZ - bendRadius;
      py = bendRadius + upD;
    }
    
    return optionalTarget.set(px, py, pz);
  }
}

const vertexShader = `
  attribute vec3 instColor;
  attribute float instOffset;
  attribute float instSpeed;
  
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vOffset;
  varying float vSpeed;
  
  void main() {
    vUv = uv;
    vColor = instColor;
    vOffset = instOffset;
    vSpeed = instSpeed;
    
    // Instance matrix applied automatically by Three.js InstancedMesh
    vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = `
  uniform float time;
  
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vOffset;
  varying float vSpeed;
  
  void main() {
    // vUv.x goes from 0 to 1 along the tube length
    
    // Create moving dashes of light
    // We want the light to travel from start to end.
    // vUv.x is 0 at the start of the curve (z=40) and 1 at the end (y=40).
    // time increases, so to make it travel from 0 to 1, we do progress = time
    // But we need it to loop and span [0, 1]
    float progress = fract(time * vSpeed + vOffset);
    
    // Distance from the current progress point
    float dist = vUv.x - progress;
    
    // Wrap around for continuous flow
    if (dist > 0.5) dist -= 1.0;
    if (dist < -0.5) dist += 1.0;
    
    // Create a sharp leading edge and a long fading tail
    float alpha = 0.0;
    if (dist <= 0.0 && dist > -0.15) {
      // The light pulse
      alpha = smoothstep(-0.15, 0.0, dist);
      // Brighten the core
      alpha = pow(alpha, 2.0); 
    }
    
    // Background dim line
    float baseAlpha = 0.05;
    
    float finalAlpha = max(baseAlpha, alpha);
    
    // Multiply by a soft edge on the sides (vUv.y is around the tube)
    float edge = sin(vUv.y * 3.14159);
    finalAlpha *= edge;
    
    vec3 finalColor = vColor;
    if (alpha > 0.5) {
      // Core burns brighter white
      finalColor = mix(vColor, vec3(1.0, 1.0, 1.0), (alpha - 0.5) * 2.0);
    }
    
    gl_FragColor = vec4(finalColor, finalAlpha);
  }
`;

function FlowLines() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  
  const curve = useMemo(() => new FlowCurve(), []);
  const geometry = useMemo(() => new THREE.TubeGeometry(curve, 128, 0.08, 8, false), [curve]);

  const [colors, offsets, speeds, matrices] = useMemo(() => {
    const cols = new Float32Array(COUNT * 3);
    const offs = new Float32Array(COUNT);
    const spds = new Float32Array(COUNT);
    const mats = new Float32Array(COUNT * 16);
    
    const matrix = new THREE.Matrix4();
    const colorPrimary = new THREE.Color('#ffffff'); // White
    const colorSecondary = new THREE.Color('#00F0FF'); // Spectral Cyan
    const tempColor = new THREE.Color();
    
    for (let i = 0; i < COUNT; i++) {
      // Random X and Z grid position
      const x = (Math.random() - 0.5) * 80;
      const z = (Math.random() - 0.5) * 20; // Slight offset so they don't all start identical
      // Wait, if it travels in Z, we translate in Z as well? Yes, to stagger them.
      
      matrix.makeTranslation(x, -5, z);
      matrix.toArray(mats, i * 16);
      
      // Only #00F0FF colors (maybe slightly lighter for variety)
      tempColor.copy(colorSecondary);
      // Boost the intensity slightly
      tempColor.multiplyScalar(1.0 + Math.random() * 1.5);
      
      tempColor.toArray(cols, i * 3);
      
      offs[i] = Math.random();
      spds[i] = 0.15 + Math.random() * 0.15; // 0.15 to 0.3 speed
    }
    
    return [cols, offs, spds, mats];
  }, []);

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.time.value = state.clock.elapsedTime;
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[null as any, null as any, COUNT]} position={[0, -2, -10]}>
      <instancedBufferAttribute attach="instanceMatrix" args={[matrices, 16]} />
      
      <tubeGeometry args={[curve, 128, 0.08, 8, false]}>
        <instancedBufferAttribute attach="attributes-instColor" args={[colors, 3]} />
        <instancedBufferAttribute attach="attributes-instOffset" args={[offsets, 1]} />
        <instancedBufferAttribute attach="attributes-instSpeed" args={[speeds, 1]} />
      </tubeGeometry>
      
      <shaderMaterial 
        ref={materialRef}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={{ time: { value: 0 } }}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        side={THREE.DoubleSide}
      />
    </instancedMesh>
  );
}

export default function SignalStreams() {
  return (
    <div className="w-full h-full">
      <Canvas
        camera={{ position: [0, 8, 30], fov: 60 }}
        dpr={[1, 2]}
        gl={{ antialias: false, powerPreference: "high-performance" }}
      >
        <color attach="background" args={['#050810']} />
        
        {/* Very subtle ambient light */}
        <ambientLight intensity={0.2} />
        
        <FlowLines />
        
        <EffectComposer multisampling={0}>
          <Bloom 
            luminanceThreshold={0.05}
            luminanceSmoothing={0.9}
            intensity={4.5}
            mipmapBlur
          />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
