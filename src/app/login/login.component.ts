import { ProjetActifService } from '../service/projet-actif.service';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { UserControllerService } from '../api/api/userController.service';
import { LoginDTO } from '../api/model/loginDTO';
import { ProjetControllerService } from '../api/api/projetController.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  constructor(
    private userService: UserControllerService,
    private router: Router,
    private projetActifService: ProjetActifService,
    private projetControllerService: ProjetControllerService
  ) {}
  // Ajout pour récupération du projet actif côté frontend
  // À adapter selon la logique métier (ex: projet actif = projet avec active=true)
  // Retourne une Promise qui résout avec le projet actif (ou null) une fois chargé
  private chargerProjetActifApresLogin(): Promise<any> {
    return new Promise((resolve) => {
      this.projetControllerService.getAllProjets('body').subscribe({
        next: (projets: any) => {
          const handleArray = (arr: any[]) => {
            const actif = arr.find((p: any) => p.active) || (arr.length > 0 ? arr[0] : null);
            if (actif) {
              this.projetActifService.setProjetActif(actif);
              try { window.sessionStorage.setItem('projetActifId', actif.id); } catch(e){}
            }
            resolve(actif);
          };

          if (projets instanceof Blob) {
            projets.text().then((txt: string) => {
              try {
                const parsed = JSON.parse(txt);
                if (Array.isArray(parsed)) {
                  handleArray(parsed);
                } else {
                  console.error('Format inattendu projets (après parsing):', parsed);
                  resolve(null);
                }
              } catch (e) {
                console.error('Erreur parsing JSON projets:', e);
                resolve(null);
              }
            }).catch((e: any) => { console.error('Erreur lecture Blob projets:', e); resolve(null); });
          } else {
            if (Array.isArray(projets)) {
              handleArray(projets);
            } else {
              console.error('Format inattendu projets:', projets);
              resolve(null);
            }
          }
        },
        error: (err: any) => {
          console.error('Erreur récupération projet actif:', err);
          resolve(null);
        }
      });
    });
  }
  
  // Charger et afficher tous les projets (comme /projet) au chargement du composant
  ngOnInit(): void {
    this.projetControllerService.getAllProjets('body').subscribe({
      next: (projets: any) => {
        if (projets instanceof Blob) {
          projets.text().then((txt: string) => {
            try {
              const parsed = JSON.parse(txt);
              console.log('Projets:', parsed);
            } catch (e) {
              console.error('Erreur parsing JSON projets (login ngOnInit):', e);
            }
          }).catch((e: any) => console.error('Erreur lecture Blob projets (login ngOnInit):', e));
        } else {
          console.log('Projets:', projets);
        }
      },
      error: (err: any) => {
        console.error('Erreur récupération projets (login ngOnInit):', err);
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
      next: async (result: any) => {
        // Parser la réponse login si c'est un Blob
        if (result instanceof Blob) {
          try {
            const txt = await result.text();
            if (txt) {
              try { result = JSON.parse(txt); } catch(e) { /* non-JSON */ }
            }
          } catch(e) {
            // ignore, result stays as Blob
          }
        }

        console.log('Réponse login:', result);
        // Le cookie JWT HttpOnly est envoyé par le backend
        // SSR: le cookie sera lu par l'intercepteur SsrJwtInterceptor
        // Récupérer le projet actif (à adapter selon votre logique)
        const projetActif = result?.projetActif || null; // Adapter selon la réponse API
        console.log('Projet actif reçu:', projetActif);
        if (projetActif && projetActif.id) {
          this.projetActifService.setProjetActif(projetActif);
          try { window.sessionStorage.setItem('projetActifId', projetActif.id); } catch(e){}
          this.router.navigate(['/projet', projetActif.id, 'parametre']);
        } else {
          // Si le projet actif n'est pas dans la réponse, le récupérer côté frontend
          const actif = await this.chargerProjetActifApresLogin();
          console.log('Projet actif après chargement:', actif);
          if (actif && actif.id) {
            this.router.navigate(['/projet', actif.id, 'parametre']);
          } else {
            // Pas de projet actif trouvé, naviguer vers l'accueil
            this.router.navigate(['/']);
          }
        }
      },
      error: (err: any) => {
        console.error('Login error:', err);
        // Affiche un message d'erreur à l'utilisateur
      }
    });
  }
}
