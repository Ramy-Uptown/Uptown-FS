import React from 'react'

export default function LoginView({
  email,
  password,
  rememberMe,
  loading,
  onChangeEmail,
  onChangePassword,
  onChangeRememberMe,
  onSubmit,
  onRegisterClick,
  onForgotPasswordClick
}) {
  return (
    <div className="min-h-screen bg-background-light text-gray-900 font-sans overflow-hidden">
      <div className="flex h-full w-full min-h-screen">
        {/* Left marketing / brand panel */}
        <div className="hidden lg:flex lg:w-5/12 xl:w-4/12 flex-col justify-center px-12 xl:px-16 bg-login-pattern relative text-white border-r border-gray-800 shadow-2xl z-10">
          <div className="absolute inset-0 bg-gradient-to-b from-[#1F2124]/95 to-[#151719]/95 z-0" />
          <div className="relative z-10 w-full max-w-md mx-auto flex flex-col h-full justify-center">
            <div className="mb-12">
              <div className="text-primary tracking-[0.25em] font-light text-4xl mb-2 uppercase">
                UPTOWN
              </div>
              <div className="flex items-center gap-3">
                <div className="h-px w-8 bg-primary" />
                <div className="text-gray-400 text-[10px] tracking-[0.3em] uppercase font-bold">
                  Financial System
                </div>
              </div>
            </div>

            <div className="mb-10">
              <h1 className="text-3xl font-semibold text-white mb-3 tracking-tight">
                Welcome Back
              </h1>
              <p className="text-gray-400 leading-relaxed font-light text-sm opacity-90">
                Secure access for authorized personnel only. Please verify your credentials
                to access the internal dashboard.
              </p>
            </div>

            <div className="space-y-5">
              <InfoCard
                icon="handshake"
                title="Deals Pipeline"
                subtitle="Track negotiations & closings."
              />
              <InfoCard
                icon="apartment"
                title="Live Inventory"
                subtitle="Monitor real-time unit availability."
              />
              <InfoCard
                icon="payments"
                title="Dynamic Pricing"
                subtitle="Adjust financial models instantly."
              />
            </div>

            <div className="mt-16 pt-8 border-t border-white/10 flex items-center justify-between text-[10px] text-gray-500 uppercase tracking-widest font-medium">
              <span>V 2.4.0</span>
              <span>© 2024 Uptown Financial</span>
            </div>
          </div>
        </div>

        {/* Right login form column */}
        <div className="flex-1 flex flex-col justify-center items-center p-6 lg:p-12 relative bg-[#F8F9FA] overflow-y-auto">
          {/* Mobile brand header */}
          <div className="lg:hidden mb-10 text-center">
            <div className="text-primary tracking-[0.2em] font-light text-3xl mb-1 uppercase">
              UPTOWN
            </div>
            <div className="text-gray-500 text-[10px] tracking-[0.4em] uppercase font-bold">
              Financial System
            </div>
          </div>

          <div className="w-full max-w-[440px]">
            <div className="bg-white rounded-2xl shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] border border-gray-200/60 p-8 md:p-12">
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
                  Account Login
                </h2>
                <p className="text-sm text-gray-500 mt-2">
                  Please enter your system credentials.
                </p>
              </div>

              <form className="space-y-5" onSubmit={onSubmit}>
                <div>
                  <label
                    htmlFor="email"
                    className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-2"
                  >
                    Email Address
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <span className="material-icons text-gray-400 group-focus-within:text-primary transition-colors text-[20px]">
                        mail
                      </span>
                    </div>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      placeholder="name@uptown.com"
                      className="block w-full pl-11 pr-3 py-3 border border-gray-200 rounded-lg bg-gray-50/50 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary sm:text-sm transition-all duration-200"
                      value={email}
                      onChange={e => onChangeEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label
                      htmlFor="password"
                      className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider"
                    >
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={onForgotPasswordClick}
                      className="text-[11px] font-bold text-primary hover:text-[#94763b] transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <span className="material-icons text-gray-400 group-focus-within:text-primary transition-colors text-[20px]">
                        lock
                      </span>
                    </div>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      required
                      placeholder="••••••••"
                      className="block w-full pl-11 pr-3 py-3 border border-gray-200 rounded-lg bg-gray-50/50 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary sm:text-sm transition-all duration-200"
                      value={password}
                      onChange={e => onChangePassword(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex items-center pt-1">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded cursor-pointer"
                    checked={rememberMe}
                    onChange={e => onChangeRememberMe(e.target.checked)}
                  />
                  <label
                    htmlFor="remember-me"
                    className="ml-2.5 block text-sm text-gray-600 cursor-pointer select-none"
                  >
                    Keep me logged in
                  </label>
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex justify-center items-center gap-2 py-3.5 px-4 border border-transparent rounded-lg shadow-sm text-[13px] font-bold text-white bg-primary hover:bg-[#94763b] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all duration-200 uppercase tracking-widest disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Signing in…' : 'Sign In'}
                    {!loading && (
                      <span className="material-icons text-[18px]">
                        arrow_forward
                      </span>
                    )}
                  </button>
                </div>
              </form>

              <div className="mt-4 text-center text-xs text-gray-500">
                <span>No account?</span>{' '}
                <button
                  type="button"
                  onClick={onRegisterClick}
                  className="text-primary font-medium hover:underline transition-colors"
                >
                  Request access
                </button>
              </div>

              <div className="mt-8 pt-6 border-t border-gray-100 text-center">
                <p className="text-xs text-gray-400">
                  Need assistance?{' '}
                  <span className="text-primary font-medium hover:underline transition-colors cursor-pointer">
                    Contact System Admin
                  </span>
                </p>
              </div>
            </div>

            <div className="mt-10 flex flex-wrap justify-center gap-x-8 gap-y-2 text-[11px] text-gray-400 uppercase tracking-widest font-semibold">
              <span className="hover:text-primary transition-colors cursor-pointer">
                Privacy Policy
              </span>
              <span className="hover:text-primary transition-colors cursor-pointer">
                Terms of Service
              </span>
              <span className="hover:text-primary transition-colors cursor-pointer">
                System Status
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoCard({ icon, title, subtitle }) {
  return (
    <div className="group flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-primary/30 transition-all duration-300">
      <div className="flex-shrink-0 p-2.5 bg-[#2A2D32] rounded-lg text-primary group-hover:bg-primary group-hover:text-white transition-colors">
        <span className="material-icons text-[20px]">
          {icon}
        </span>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-white tracking-wide">
          {title}
        </h3>
        <p className="text-xs text-gray-500 mt-0.5 group-hover:text-gray-300 transition-colors">
          {subtitle}
        </p>
      </div>
    </div>
  )
}