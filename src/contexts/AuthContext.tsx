import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { auth, googleProvider, signInWithPopup, onAuthStateChanged, db, doc, getDoc, setDoc, serverTimestamp, increment } from '../firebase';
import type { User as FirebaseUser } from 'firebase/auth';
import { posthog } from '../lib/posthog';

interface UserSettings {
  themeColor: string;
  fontFamily: string;
  isDarkMode?: boolean;
  autoDescribe?: boolean;
}

export type PlanType = 'trial' | 'basic' | 'premium';

interface UserUsage {
  totalGenerations: number;
  dailyGenerations: number;
  lastGenerationDate: string;
}

interface User {
  uid: string;
  username: string;
  email: string;
  avatar_data?: string | null;
  settings?: UserSettings;
  plan: PlanType;
  usage: UserUsage;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (email: string, pass: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (userData: User) => void;
  updateSettings: (settings: UserSettings) => Promise<void>;
  updatePlan: (plan: PlanType) => Promise<void>;
  incrementUsage: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        // Check if user exists in Firestore, if not create
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);
        
        let userData: User;
        if (!userDoc.exists()) {
          userData = {
            uid: firebaseUser.uid,
            username: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
            email: firebaseUser.email || '',
            avatar_data: firebaseUser.photoURL || null,
            settings: {
              themeColor: '#4f46e5',
              fontFamily: 'Inter',
              isDarkMode: false,
              autoDescribe: true
            },
            plan: 'trial',
            usage: {
              totalGenerations: 0,
              dailyGenerations: 0,
              lastGenerationDate: new Date().toISOString().split('T')[0]
            }
          } as User;

          await setDoc(userDocRef, {
            uid: userData.uid,
            username: userData.username,
            email: userData.email,
            avatar_data: userData.avatar_data,
            settings: userData.settings,
            plan: userData.plan,
            usage: userData.usage,
            createdAt: serverTimestamp()
          });
        } else {
          const data = userDoc.data() as any;
          userData = {
            uid: data.uid,
            username: data.username,
            email: data.email,
            avatar_data: data.avatar_data,
            settings: data.settings || {
              themeColor: '#4f46e5',
              fontFamily: 'Inter',
              autoDescribe: true
            },
            plan: data.plan || 'trial',
            usage: data.usage || {
              totalGenerations: 0,
              dailyGenerations: 0,
              lastGenerationDate: new Date().toISOString().split('T')[0]
            }
          };
        }
        posthog.identify(userData.uid, {
          username: userData.username,
          plan: userData.plan,
        });
        setUser(userData);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      posthog.capture('user_logged_in', { method: 'google' });
    } catch (error) {
      console.error('Google login error:', error);
      throw error;
    }
  };

  const loginWithEmail = async (email: string, pass: string) => {
    try {
      const { signInWithEmailAndPassword } = await import('../firebase');
      await signInWithEmailAndPassword(auth, email, pass);
      posthog.capture('user_logged_in', { method: 'email' });
    } catch (error) {
      console.error('Email login error:', error);
      throw error;
    }
  };

  const registerWithEmail = async (email: string, pass: string) => {
    try {
      const { createUserWithEmailAndPassword } = await import('../firebase');
      await createUserWithEmailAndPassword(auth, email, pass);
      posthog.capture('user_signed_up', { method: 'email' });
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const { sendPasswordResetEmail } = await import('../firebase');
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      console.error('Reset password error:', error);
      throw error;
    }
  };

  const updatePlan = async (plan: PlanType) => {
    if (!user) return;
    try {
      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, { plan }, { merge: true });
      setUser({ ...user, plan });
    } catch (error) {
      console.error('Update plan error:', error);
      throw error;
    }
  };

  const incrementUsage = async (): Promise<boolean> => {
    if (!user) return false;
    
    const today = new Date().toISOString().split('T')[0];
    const userDocRef = doc(db, 'users', user.uid);
    
    let { totalGenerations, dailyGenerations, lastGenerationDate } = user.usage;
    
    // Reset daily counter if it's a new day
    if (lastGenerationDate !== today) {
      dailyGenerations = 0;
      lastGenerationDate = today;
    }

    // Check limits
    if (user.plan === 'trial' && totalGenerations >= 3) {
      return false;
    }
    if (user.plan === 'basic' && dailyGenerations >= 30) {
      return false;
    }

    const newUsage = {
      totalGenerations: totalGenerations + 1,
      dailyGenerations: dailyGenerations + 1,
      lastGenerationDate
    };

    try {
      await setDoc(userDocRef, { usage: newUsage }, { merge: true });
      setUser({ ...user, usage: newUsage });
      return true;
    } catch (error: any) {
      console.error('Increment usage error:', error);
      if (error.message?.includes('quota') || error.message?.includes('exhausted')) {
        // This will be caught by the caller who will show the pricing/quota error modal
      }
      return false;
    }
  };

  const logout = async () => {
    try {
      posthog.capture('user_logged_out');
      posthog.reset();
      await auth.signOut();
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const updateUser = (userData: User) => {
    setUser(userData);
  };

  const updateSettings = async (settings: UserSettings) => {
    if (!user) return;
    try {
      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, { settings }, { merge: true });
      setUser({ ...user, settings });
    } catch (error) {
      console.error('Update settings error:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      loginWithGoogle, 
      loginWithEmail, 
      registerWithEmail, 
      resetPassword, 
      logout, 
      updateUser,
      updateSettings,
      updatePlan,
      incrementUsage
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
