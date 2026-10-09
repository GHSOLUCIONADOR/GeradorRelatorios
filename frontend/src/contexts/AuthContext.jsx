import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, googleProvider, signInWithPopup, signOut } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { setUsuarioAuditoria, registrarAcaoAuditoria } from '../services/auditService';
import { setUsuarioMonitor } from '../services/monitorService';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Check if user is in our backend (invited)
          const res = await fetch(`/api/me?email=${encodeURIComponent(firebaseUser.email)}`);
          let data = {};
          try {
            data = await res.json();
          } catch (e) {
            data = {};
          }

          if (!res.ok) {
            // Not invited or no profile
            setError(data.error || 'Acesso negado ou servidor indisponível.');
            await signOut(auth);
            setCurrentUser(null);
            setUserProfile(null);
            setUsuarioAuditoria(null);
            setUsuarioMonitor(null);
          } else {
            setCurrentUser(firebaseUser);
            setUserProfile(data.perfil); // { telas_acesso, categorias_modelos, isAdmin }
            setUsuarioAuditoria(firebaseUser);
            setUsuarioMonitor(firebaseUser);
            setError('');

            // Registrar Auditoria de Login
            registrarAcaoAuditoria({
              tipo_processo: 'LOGIN',
              descricao: `Usuário autenticado com sucesso no sistema`,
              usuario_email: firebaseUser.email,
              usuario_nome: firebaseUser.displayName,
              detalhes: {
                provedor: firebaseUser.providerData?.[0]?.providerId || 'google',
                isAdmin: data.perfil?.isAdmin || false
              }
            });
          }
        } catch (err) {
          console.error(err);
          setError('Erro de conexão ao verificar permissões.');
          await signOut(auth);
          setCurrentUser(null);
          setUserProfile(null);
          setUsuarioAuditoria(null);
          setUsuarioMonitor(null);
        }
      } else {
        setCurrentUser(null);
        setUserProfile(null);
        setUsuarioAuditoria(null);
        setUsuarioMonitor(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const loginWithGoogle = async () => {
    setError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error(err);
      setError('Falha ao fazer login com o Google.');
    }
  };

  const logout = () => {
    if (currentUser) {
      registrarAcaoAuditoria({
        tipo_processo: 'LOGOUT',
        descricao: `Usuário desconectou-se do sistema`,
        usuario_email: currentUser.email,
        usuario_nome: currentUser.displayName
      });
    }
    return signOut(auth);
  };

  const value = {
    currentUser,
    userProfile,
    loginWithGoogle,
    logout,
    error
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
