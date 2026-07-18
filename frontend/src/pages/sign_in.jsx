import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import auth from '../lib/neonAuth';
import { ShaderGradient, ShaderGradientCanvas } from '@shadergradient/react';

const SignIn = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [formData, setFormData] = useState({
    email: "",
    password: ""
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lockoutTimeRemaining, setLockoutTimeRemaining] = useState(() => {
    const savedLockout = sessionStorage.getItem('lockoutUntil');
    if (savedLockout) {
      const remaining = Math.floor((parseInt(savedLockout, 10) - Date.now()) / 1000);
      if (remaining > 0) return remaining;
      sessionStorage.removeItem('lockoutUntil');
    }
    return 0;
  });

  useEffect(() => {
    let timer;
    if (lockoutTimeRemaining > 0) {
      timer = setInterval(() => {
        setLockoutTimeRemaining((prev) => {
          if (prev <= 1) {
            sessionStorage.removeItem('lockoutUntil');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [lockoutTimeRemaining]);

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.id]: e.target.value
    });
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (error) throw error;

      const session = await auth.getSession();
      const userEmail = session?.data?.user?.email || formData.email;
      const userName = session?.data?.user?.user_metadata?.name ||
                       session?.data?.user?.user_metadata?.full_name ||
                       userEmail.split('@')[0];

      sessionStorage.setItem('username', userEmail);
      sessionStorage.setItem('displayName', userName);
      sessionStorage.setItem('token', data?.session?.access_token || "");
      showToast("Login successful! Redirecting...", "success");

      setTimeout(() => navigate("/home", { state: { showPreloader: true } }), 1500);
    } catch (err) {
      console.error(err);
      const errorMessage = err?.message || err?.error_description || "Invalid email or password.";
      if (errorMessage.toLowerCase().includes('network') || errorMessage.toLowerCase().includes('fetch')) {
        showToast("Cannot reach Neon auth service. Please try again later.", "error");
      } else {
        showToast(errorMessage, "error");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-black p-4 relative overflow-hidden">

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

      <button
        type="button"
        onClick={() => {
          if (location.state?.fromLogout) {
            navigate("/");
          } else {
            navigate(-1);
          }
        }}
        className="absolute top-6 left-6 text-white/80 hover:text-white transition-colors cursor-pointer flex items-center gap-2 z-10"
      >
        <span>&larr;</span> Back
      </button>

      <div className="relative bg-white/10 backdrop-blur-xl border border-white/20 rounded-[2.5rem] w-full max-w-sm p-10 flex flex-col shadow-2xl overflow-hidden z-10">

        {/* Card decorative circle — top right */}
        <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full bg-white/20 blur-xl pointer-events-none" />

        {/* Card decorative circle — bottom left */}
        <div className="absolute -bottom-10 -left-10 w-28 h-28 rounded-full bg-white/20 blur-xl pointer-events-none" />

        {/* Toast notification */}
        {toast && (
          <div className={`absolute top-4 left-4 right-4 z-20 px-4 py-3 rounded-xl text-white text-sm font-medium shadow-lg flex items-center gap-2
            ${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
            <span>{toast.type === 'success' ? '✓' : '✕'}</span>
            {toast.message}
          </div>
        )}

        <h1 className="text-4xl font-bold text-white text-center mb-8 relative z-10">Login</h1>

        <form className="w-full flex flex-col relative z-10" onSubmit={handleSignIn}>
          <div className="mb-5">
            <label htmlFor="email" className="block text-gray-300 text-sm mb-2">Email</label>
            <input
              type="email"
              id="email"
              onChange={handleChange}
              autoComplete="email"
              className="w-full bg-white/10 border border-white/10 rounded-xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-blue-400 text-white placeholder-gray-400"
              required
            />
          </div>

          <div className="mb-3">
            <label htmlFor="password" className="block text-gray-300 text-sm mb-2">Password</label>
            <input
              type={showPassword ? "text" : "password"}
              id="password"
              onChange={handleChange}
              disabled={lockoutTimeRemaining > 0}
              autoComplete="current-password"
              className="w-full bg-white/10 border border-white/10 rounded-xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-blue-400 text-white placeholder-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
              required
            />
          </div>

          <div className="flex items-center mb-7">
            <input
              type="checkbox"
              id="showPassword"
              className="w-4 h-4 mr-2 border-gray-300 rounded text-blue-500 focus:ring-blue-500 cursor-pointer accent-blue-500"
              onChange={(e) => setShowPassword(e.target.checked)}
            />
            <label htmlFor="showPassword" className="text-gray-300 text-sm cursor-pointer select-none">Show Password</label>
          </div>

          <button
            type="submit"
            disabled={loading || lockoutTimeRemaining > 0}
            className="w-full bg-white hover:bg-gray-200 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed text-black font-bold py-4 rounded-xl transition-all text-base tracking-widest uppercase mb-7 shadow-lg shadow-white/20"
          >
            {lockoutTimeRemaining > 0 ? `LOCKED (${lockoutTimeRemaining}s)` : (loading ? "Signing in..." : "SIGN IN")}
          </button>
        </form>

        <div className="text-center w-full flex flex-col gap-2 text-sm text-gray-300 relative z-10">
          <p>
            Don't have an account? <Link to="/sign-up" className="text-blue-400 hover:text-blue-300 font-medium">Sign up</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignIn;