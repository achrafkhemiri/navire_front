import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent {
  @Input() isSidebarOpen: boolean = true;
  @Input() sidebarWidth: number = 220; // largeur ouverte
  @Input() sidebarClosedWidth: number = 70; // largeur fermée
}
