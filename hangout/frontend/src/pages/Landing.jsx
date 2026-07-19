import React from 'react';
import { ShaderGradient, ShaderGradientCanvas } from '@shadergradient/react';
import { ShimmerButton } from '../components/ui/shimmer-button';
import { useNavigate } from 'react-router-dom';

export default function Landing() {
  const navigate = useNavigate();

  const handleGetStarted = () => {
    navigate('/sign-in');
  };
  return (
    <div className="relative w-full h-screen overflow-hidden bg-black text-white">
      {/* Background Shader Gradient */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <ShaderGradientCanvas style={{ width: '100%', height: '100%' }}>
          <ShaderGradient
            animate="on"
            axesHelper="on"
            bgColor1="#000000"
            bgColor2="#000000"
            brightness={1.1}
            cAzimuthAngle={180}
            cDistance={3.91}
            cPolarAngle={115}
            cameraZoom={1}
            color1="#848884"
            color2="#36454F"
            color3="#000000"
            destination="onCanvas"
            embedMode="off"
            envPreset="city"
            format="gif"
            fov={45}
            frameRate={10}
            gizmoHelper="hide"
            grain="off"
            lightType="3d"
            pixelDensity={1}
            positionX={-0.5}
            positionY={0.1}
            positionZ={0}
            range="disabled"
            rangeEnd={40}
            rangeStart={0}
            reflection={0.1}
            rotationX={0}
            rotationY={0}
            rotationZ={235}
            shader="defaults"
            type="waterPlane"
            uAmplitude={0}
            uDensity={1.1}
            uFrequency={5.5}
            uSpeed={0.1}
            uStrength={2.4}
            uTime={0.2}
            wireframe={false}
          />
        </ShaderGradientCanvas>
      </div>

      {/* Foreground Content */}
      <div className="relative z-10 flex flex-col items-center justify-center w-full h-full p-8">
        <h1 className="text-6xl font-extrabold tracking-tight mb-4 text-transparent bg-clip-text bg-linear-to-r from-white to-gray-300 drop-shadow-lg">
          Hangout
        </h1>
        <p className="text-xl text-gray-200 mb-8 max-w-lg text-center font-medium drop-shadow-md">
          A seamless way to connect and share moments with everyone.
        </p>
        <ShimmerButton
          onClick={handleGetStarted}
          shimmerColor="#ffffff"
          shimmerSize="2px"
          shimmerDuration="2.5s"
          background="rgba(255, 255, 255, 0.08)"
          borderRadius="100px"
          className="px-10 py-4 backdrop-blur-md border border-white/20 shadow-[0_8px_32px_rgba(255,255,255,0.1),inset_0_1px_0_rgba(255,255,255,0.15)] hover:scale-105 hover:shadow-[0_8px_40px_rgba(255,255,255,0.18)] transition-all duration-300"
        >
          <span className="whitespace-pre-wrap text-center text-base font-semibold leading-none tracking-widest text-white drop-shadow-sm lg:text-lg">
            Get Started
          </span>
        </ShimmerButton>
      </div>
    </div>
  );
}
