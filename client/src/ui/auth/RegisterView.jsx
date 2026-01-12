import React from 'react'

export default function RegisterView({
  firstName,
  lastName,
  email,
  department,
  password,
  termsAccepted,
  loading,
  onChangeFirstName,
  onChangeLastName,
  onChangeEmail,
  onChangeDepartment,
  onChangePassword,
  onChangeTerms,
  onSubmit,
  onLoginClick
}) {
  return (
    <div className="bg-background-light min-h-screen flex flex-col">
      {/* Soft gold background glows */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-primary opacity-5 rounded-full blur-[120px]" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-primary opacity-10 rounded-full blur-[120px]" />
      </div>

      <main className="relative z-10 flex-grow flex items-center justify-center p-6">
        <div className="w-full max-w-lg">
          <div className="text-center mb-8">
            <div className="inline-block mb-2">
              <h1 className="text-3xl font-display font-bold tracking-widest text-primary uppercase">
                Uptown
              </h1>
              <p className="text-[10px] tracking-[0.3em] font-medium text-slate-500 uppercase">
                6 October Financial System
              </p>
            </div>
          </div>

          <div className="bg-white shadow-2xl rounded-2xl overflow-hidden border border-slate-200">
            <div className="p-8 md:p-10">
              <div className="mb-8">
                <h2 className="text-2xl font-semibold text-slate-800 mb-2">Create Account</h2>
                <p className="text-slate-500 text-sm">
                  Register to access the internal financial management portal.
                </p>
              </div>

              <form className="space-y-5" onSubmit={onSubmit}>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="first-name"
                      className="text-xs font-semibold text-slate-700 uppercase tracking-wider"
                    >
                      First Name
                    </label>
                    <input
                      id="first-name"
                      type="text"
                      placeholder="John"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none text-slate-800"
                      value={firstName}
                      onChange={e => onChangeFirstName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label
                      htmlFor="last-name"
                      className="text-xs font-semibold text-slate-700 uppercase tracking-wider"
                    >
                      Last Name
                    </label>
                    <input
                      id="last-name"
                      type="text"
                      placeholder="Doe"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none text-slate-800"
                      value={lastName}
                      onChange={e => onChangeLastName(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="email"
                    className="text-xs font-semibold text-slate-700 uppercase tracking-wider"
                  >
                    Work Email
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 material-icons text-slate-400 text-sm">
                      email
                    </span>
                    <input
                      id="email"
                      type="email"
                      placeholder="name@uptown.com"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none text-slate-800"
                      value={email}
                      onChange={e => onChangeEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="department"
                    className="text-xs font-semibold text-slate-700 uppercase tracking-wider"
                  >
                    Department
                  </label>
                  <select
                    id="department"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none text-slate-800 appearance-none"
                    value={department}
                    onChange={e => onChangeDepartment(e.target.value)}
                  >
                    <option value="">Select Department</option>
                    <option value="sales">Sales &amp; Marketing</option>
                    <option value="finance">Finance &amp; Accounts</option>
                    <option value="admin">Administration</option>
                    <option value="inventory">Inventory Management</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="password"
                    className="text-xs font-semibold text-slate-700 uppercase tracking-wider"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 material-icons text-slate-400 text-sm">
                      lock
                    </span>
                    <input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none text-slate-800"
                      value={password}
                      onChange={e => onChangePassword(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2 py-2">
                  <input
                    id="terms"
                    type="checkbox"
                    className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                    checked={termsAccepted}
                    onChange={e => onChangeTerms(e.target.checked)}
                  />
                  <label
                    htmlFor="terms"
                    className="text-xs text-slate-500"
                  >
                    I agree to the{' '}
                    <span className="text-primary font-medium">Terms of Service</span> and{' '}
                    <span className="text-primary font-medium">Privacy Policy</span>.
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 bg-primary hover:bg-[#b8954d] disabled:opacity-70 disabled:cursor-not-allowed active:transform active:scale-[0.98] text-white font-semibold rounded-lg shadow-lg shadow-primary/20 transition-all duration-200 flex items-center justify-center space-x-2"
                >
                  <span>{loading ? 'Registering…' : 'Complete Registration'}</span>
                  {!loading && (
                    <span className="material-icons text-sm">
                      arrow_forward
                    </span>
                  )}
                </button>
              </form>
            </div>
            <div className="bg-slate-50 px-8 py-5 border-t border-slate-100 text-center">
              <p className="text-sm text-slate-500">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={onLoginClick}
                  className="text-primary font-semibold hover:underline"
                >
                  Sign In
                </button>
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-col items-center justify-center space-y-4">
            <div className="flex space-x-6 text-xs font-medium text-slate-400 uppercase tracking-widest">
              <span className="hover:text-primary transition-colors cursor-pointer">About Firm</span>
              <span>•</span>
              <span className="hover:text-primary transition-colors cursor-pointer">Help Center</span>
              <span>•</span>
              <span className="hover:text-primary transition-colors cursor-pointer">Support</span>
            </div>
            <p className="text-[10px] text-slate-400">
              © 2024 Uptown Financial System. Powered by Uppap.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}