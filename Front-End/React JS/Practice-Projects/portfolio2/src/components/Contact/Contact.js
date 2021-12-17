import React, { useState } from 'react';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Button } from 'primereact/button';

import './Contact.css';
import messageImage from '../../assets/images/message.png';

export default function Contact() {
	const [value1, setValue1] = useState('');
	const [value14, setValue14] = useState('');

	return (
		<>
			<br/>
			<h1 align="center">Contact</h1>
			<br/>
			<div className="card container">
				<img className="messageImage" src={messageImage} alt="message here"/>
                <div className="p-fluid p-grid">
                    <div className="p-field p-col-12 p-md-4">
                        <span className="p-float-label">
                            <InputText id="inputtext" value={value1} onChange={(e) => setValue1(e.target.value)} />
                            <label htmlFor="inputtext">Name</label>
                        </span>
                    </div>
                    <div className="p-field p-col-12 p-md-4">
                        <span className="p-float-label">
                            <InputText id="inputtext" value={value1} onChange={(e) => setValue1(e.target.value)} />
                            <label htmlFor="inputtext">Email</label>
                        </span>
                    </div>
                    <div className="p-field p-col-12 p-md-4">
                        <span className="p-float-label">
                            <InputTextarea id="textarea" value={value14} onChange={(e) => setValue14(e.target.value)} rows={3} />
                            <label htmlFor="textarea">Message</label>
                        </span>
                    </div>
                    <Button label="Submit" icon="pi pi-check" iconPos="right" />
                </div>
            </div>
		</>
	)
}