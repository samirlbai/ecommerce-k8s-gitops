<template>
    <div class="auth-test">
      <h2>Authentification</h2>
      
      <!-- Formulaire d'inscription -->
      <div class="auth-form" v-if="!userProfile">
        <h3>Inscription</h3>
        <input v-model="registerForm.email" type="email" placeholder="Email">
        <input v-model="registerForm.password" type="password" placeholder="Mot de passe">
        <button @click="register">S'inscrire</button>
      </div>
  
      <!-- Formulaire de connexion -->
      <div class="auth-form" v-if="!userProfile">
        <h3>Connexion</h3>
        <input v-model="loginForm.email" type="email" placeholder="Email">
        <input v-model="loginForm.password" type="password" placeholder="Mot de passe">
        <button @click="login">Se connecter</button>
      </div>
  
      <!-- Affichage du profil -->
      <div v-if="userProfile" class="profile">
        <h3>Profil</h3>
        <p>Email: {{ userProfile.email }}</p>
        <button @click="logout">Se déconnecter</button>
      </div>
    </div>
  </template>
  
  <script>
  import axios from 'axios';
  
  export default {
    name: 'AuthTest',
    emits: ['login-success', 'logout'], // Ajouter l'émission de logout
    data() {
      return {
        registerForm: {
          email: '',
          password: ''
        },
        loginForm: {
          email: '',
          password: ''
        },
        userProfile: null
      }
    },
    methods: {
      async register() {
        try {
          const response = await axios.post('/api/auth/register', this.registerForm);
          console.log('Inscription réussie:', response.data);
          localStorage.setItem('token', response.data.token);
          localStorage.setItem('userId', response.data.userId); // Stocker l'ID utilisateur
          await this.getProfile();
          this.$emit('login-success', response.data.userId);
        } catch (error) {
          console.error('Erreur inscription:', error);
          alert(error.response?.data?.message || 'Erreur lors de l\'inscription');
        }
      },
      async login() {
        try {
          const response = await axios.post('/api/auth/login', this.loginForm);
          console.log('Connexion réussie:', response.data);
          localStorage.setItem('token', response.data.token);
          localStorage.setItem('userId', response.data.userId); // Stocker l'ID utilisateur
          await this.getProfile();
          this.$emit('login-success', response.data.userId);
        } catch (error) {
          console.error('Erreur connexion:', error);
          alert(error.response?.data?.message || 'Erreur lors de la connexion');
        }
      },
      async getProfile() {
        try {
          const token = localStorage.getItem('token');
          if (!token) return;
          
          const response = await axios.get('/api/auth/profile', {
            headers: { Authorization: `Bearer ${token}` }
          });
          this.userProfile = response.data;
          if (this.userProfile) {
            localStorage.setItem('userId', this.userProfile._id); // Stocker l'ID depuis le profil
            this.$emit('login-success', this.userProfile._id);
          }
        } catch (error) {
          console.error('Erreur profil:', error);
          this.handleLogout();
        }
      },
      handleLogout() {
        localStorage.removeItem('token');
        localStorage.removeItem('userId');
        this.userProfile = null;
        this.loginForm = { email: '', password: '' };
        this.registerForm = { email: '', password: '' };
        this.$emit('logout');
      },
      logout() {
        this.handleLogout();
        window.location.reload();
      }
    },
    mounted() {
      this.getProfile();
    }
  }
  </script>
  
  <style scoped>
  .auth-test {
    padding: 20px;
    max-width: 400px;
    margin: 0 auto;
  }
  
  .auth-form {
    margin: 20px 0;
    padding: 20px;
    border: 1px solid #ddd;
    border-radius: 8px;
    background: white;
  }
  
  input {
    display: block;
    margin: 10px 0;
    padding: 8px;
    width: 100%;
    border: 1px solid #ddd;
    border-radius: 4px;
  }
  
  button {
    background: #42b983;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    width: 100%;
    margin-top: 10px;
  }
  
  button:hover {
    background: #3aa876;
  }
  
  .profile {
    margin-top: 20px;
    padding: 20px;
    background: #f5f5f5;
    border-radius: 8px;
  }
  </style>