import { ProjetActifService } from '../service/projet-actif.service';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { UserControllerService } from '../api/api/userController.service';
import { LoginDTO } from '../api/model/loginDTO';
import { ProjetControllerService } from '../api/api/projetController.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  constructor(
    private userService: UserControllerService,
    private router: Router,
    private projetActifService: ProjetActifService,
    private projetControllerService: ProjetControllerService
  ) {}
  // Ajout pour récupération du projet actif côté frontend
  // À adapter selon la logique métier (ex: projet actif = projet avec active=true)
  private chargerProjetActifApresLogin() {
    // Injecter ProjetControllerService dans le constructeur
    // Charger tous les projets et prendre le premier projet actif
    this.projetControllerService.getAllProjets('body').subscribe({
      next: (projets: any) => {
        let actif = null;
        if (Array.isArray(projets)) {
          actif = projets.find((p: any) => p.active);
        }
        if (actif) {
          this.projetActifService.setProjetActif(actif);
          window.sessionStorage.setItem('projetActifId', actif.id);
        }
      },
      error: (err: any) => {
        console.error('Erreur récupération projet actif:', err);
      }
    });
  }
  email: string = '';
  password: string = '';


  onSubmit() {
    const loginData: LoginDTO = {
      mail: this.email,
      password: this.password
    };
    this.userService.login(loginData).subscribe({
      next: (result: any) => {
        console.log('Réponse login:', result);
        // Le cookie JWT HttpOnly est envoyé par le backend
        // SSR: le cookie sera lu par l'intercepteur SsrJwtInterceptor
        // Récupérer le projet actif (à adapter selon votre logique)
        const projetActif = result?.projetActif || null; // Adapter selon la réponse API
        console.log('Projet actif reçu:', projetActif);
        if (projetActif && projetActif.id) {
          this.projetActifService.setProjetActif(projetActif);
          window.sessionStorage.setItem('projetActifId', projetActif.id);
          this.router.navigate(['/projet-parametre']);
        } else {
          // Si le projet actif n'est pas dans la réponse, le récupérer côté frontend
          this.chargerProjetActifApresLogin();
          this.router.navigate(['/projet-parametre']);
        }
      },
      error: (err: any) => {
        console.error('Login error:', err);
        // Affiche un message d'erreur à l'utilisateur
      }
    });
  }
}
