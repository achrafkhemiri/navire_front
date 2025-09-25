import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-projet-parametre',
  templateUrl: './projet-parametre.component.html',
  styleUrls: ['./projet-parametre.component.css']
})
export class ProjetParametreComponent {
  isSidebarOpen: boolean = true;
  projetId: number | null = null;

  constructor(private route: ActivatedRoute, private router: Router) {
    this.route.paramMap.subscribe(params => {
      this.projetId = Number(params.get('id'));
    });
  }
}
