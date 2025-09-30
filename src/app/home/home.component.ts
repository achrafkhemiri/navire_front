import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ProjetActifService } from '../service/projet-actif.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {
  // 👉 ajout de la variable pour gérer l'état de la sidebar
  isSidebarOpen = true;

  constructor(private router: Router, private projetActifService: ProjetActifService) {}

  ngOnInit() {
    const projet = this.projetActifService.getProjetActif();
    const isAllProjects = this.projetActifService.getViewMode();
    if (projet && projet.id && !isAllProjects) {
      this.router.navigate(['/projet', projet.id, 'parametre']);
    }
  }
}
