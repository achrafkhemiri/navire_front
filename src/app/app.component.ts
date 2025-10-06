import { Component } from '@angular/core';
import { AuthService } from './service/auth.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'frontend';
  constructor(private authService: AuthService) {
    // Force une vérification de l'état d'authentification au démarrage
    // (le service s'en occupe déjà dans son constructeur)
  }
}
