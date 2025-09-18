import { Component } from '@angular/core';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent {
  // 👉 ajout de la variable pour gérer l'état de la sidebar
  isSidebarOpen = true;
}
