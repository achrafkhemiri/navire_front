import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ProjetActifService } from '../../service/projet-actif.service';

@Component({
  selector: 'app-projet-parametre',
  templateUrl: './projet-parametre.component.html',
  styleUrls: ['./projet-parametre.component.css']
})
export class ProjetParametreComponent {
  isSidebarOpen: boolean = true;
  projetId: number | null = null;

  constructor(private route: ActivatedRoute, private router: Router, private projetActifService: ProjetActifService) {
    this.route.paramMap.subscribe(params => {
      this.projetId = Number(params.get('id'));
      if (this.projetId) {
        // Set the active project for other components to consume
        this.projetActifService.setProjetActif({ id: this.projetId });
        // also keep in sessionStorage for components that fallback to it
        window.sessionStorage.setItem('projetActifId', String(this.projetId));
      }
    });
  }
}
