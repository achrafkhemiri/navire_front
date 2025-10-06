import { ProjetActifService } from '../service/projet-actif.service';
import { AuthService } from '../service/auth.service';
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
    private projetControllerService: ProjetControllerService,
    private authService: AuthService
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
            } catch (e) {
              console.error('Erreur parsing JSON projets (login ngOnInit):', e);
            }
          }).catch((e: any) => console.error('Erreur lecture Blob projets (login ngOnInit):', e));
        } else {
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
    const loginData: LoginDTO = { mail: this.email, password: this.password };
    this.userService.login(loginData).subscribe({
      next: async (result: any) => {
        if (result instanceof Blob) {
          try { const txt = await result.text(); if (txt) { try { result = JSON.parse(txt); } catch {} } } catch {}
        }
        this.authService.markLoggedIn();

        const projetActif = result?.projetActif || null;
        let cibleNavig = ['/'];
        if (projetActif && projetActif.id) {
          this.projetActifService.setProjetActif(projetActif);
          try { window.sessionStorage.setItem('projetActifId', projetActif.id); } catch {}
          cibleNavig = ['/projet', projetActif.id, 'parametre'];
          this.router.navigate(cibleNavig);
        } else {
          const actif = await this.chargerProjetActifApresLogin();
            if (actif && actif.id) {
              cibleNavig = ['/projet', actif.id, 'parametre'];
            }
            this.router.navigate(cibleNavig);
        }
        // Fallback si toujours sur /login après 400ms
        setTimeout(() => {
          if (window.location.pathname.includes('login')) {
            this.authService.markLoggedIn();
            this.router.navigate(cibleNavig);
          }
        }, 400);
      },
      error: (err: any) => {
        console.error('Login error:', err);
      }
    });
  }
}
