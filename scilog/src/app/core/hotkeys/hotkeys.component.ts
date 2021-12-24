import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component({
  selector: 'app-hotkeys',
  templateUrl: './hotkeys.component.html',
  styleUrls: ['./hotkeys.component.css']
})
export class HotkeysComponent implements OnInit {

  hotkeys = Array.from(this.data);
  hotkeysSorted:Object = {};
  hotkeyGroups: string[];
  constructor(@Inject(MAT_DIALOG_DATA) public data) { }

  ngOnInit() { 
    
    this.hotkeys.forEach((entry:any)=>{
      let tmp = {key: entry[0], label: entry[1]["label"]};
      if (this.hotkeysSorted[entry[1]["group"]]){
        this.hotkeysSorted[entry[1]["group"]].push(tmp)
      } else {
        this.hotkeysSorted[entry[1]["group"]] = [tmp];
      }
    });

    this.hotkeyGroups = Object.keys(this.hotkeysSorted);
  }

}
