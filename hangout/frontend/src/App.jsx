import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import Landing from "./pages/Landing";
import SignUp from "./pages/sign_up";
import SignIn from "./pages/sign_in";

import About from "./pages/About";

// 1. Import the new Call component
import Call from "./pages/Call"; 

export default function App() {
  return (
    <div className="min-h-screen w-full relative">
      <Router>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/home" element={<Home />} />
            <Route path="/sign-up" element={<SignUp />} />
            <Route path="/sign-in" element={<SignIn />} />
            <Route path="/about" element={<About />} />
            
            {/* 2. Add the dynamic Call Route */}
            <Route path="/call/:roomId" element={<Call />} />
            
            {/* If a user goes to a URL that doesn't exist, redirect to Home */}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
      </Router>
    </div>
  );
}