import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { HomeComponent } from './home/home.component';
import { LoginComponent } from './login/login.component';


const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'login', component: LoginComponent },



  // Exemple de routes à ajouter :
  // { path: 'profil', component: ProfilComponent },
  // { path: 'parametres', component: ParametresComponent },
  { path: '**', redirectTo: '' } // Redirige toute route inconnue vers Home
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
