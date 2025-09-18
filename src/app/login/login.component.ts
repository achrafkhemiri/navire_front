import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { UserControllerService } from '../api/api/userController.service';
import { LoginDTO } from '../api/model/loginDTO';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  email: string = '';
  password: string = '';

  constructor(private userService: UserControllerService, private router: Router) {}

  onSubmit() {
    const loginData: LoginDTO = {
      mail: this.email,
      password: this.password
    };
    this.userService.login(loginData).subscribe({
      next: (result: any) => {
        console.log('Login success:', result);
        this.router.navigate(['/']); // Redirection vers la page d'accueil
      },
      error: (err: any) => {
        console.error('Login error:', err);
        // Affiche un message d'erreur à l'utilisateur
      }
    });
  }
}
